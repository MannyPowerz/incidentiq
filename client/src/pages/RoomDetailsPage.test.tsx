/**
 * RoomDetailsPage.test.tsx — one room against a mocked api module. The ordering test is the one
 * that matters most: the timeline is sorted by entry id (ADR 0001), whatever order rows arrive in.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ToastProvider } from '../components/ui';
import RoomDetailsPage from './RoomDetailsPage';
import {
    ApiError,
    confirmAiDraft,
    connectSocket,
    getIncident,
    listTimeline,
    postTimelineEntry,
    rejectAiDraft,
    requestAiDraft,
    resolveIncident,
} from '../api';
import type { Incident, TimelineEntry } from '../api';
import { setAccessToken } from '../auth/tokenStore';
import { fakeSocket } from '../test/fakeSocket';

vi.mock('../api', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../api')>()),
    getIncident: vi.fn(),
    listTimeline: vi.fn(),
    postTimelineEntry: vi.fn(),
    resolveIncident: vi.fn(),
    requestAiDraft: vi.fn(),
    confirmAiDraft: vi.fn(),
    rejectAiDraft: vi.fn(),
    connectSocket: vi.fn(),
}));

// fireEvent, not user-event: no new dependency for what three helpers cover
const user = {
    click: (el: Element) => fireEvent.click(el),
    type: (el: Element, value: string) => fireEvent.change(el, { target: { value } }),
    selectOptions: (el: Element, value: string) => fireEvent.change(el, { target: { value } }),
};

const incident = (over: Partial<Incident> = {}): Incident => ({
    id: 5,
    title: 'VPN drops',
    status: 'investigating',
    org_id: 1,
    severity: 'P2',
    created_by: 1,
    created_at: new Date().toISOString(),
    affected_system: 'auth',
    resolved_at: null,
    ...over,
});

const entry = (id: number, over: Partial<TimelineEntry> = {}): TimelineEntry => ({
    id,
    incident_id: 5,
    author_id: 9,
    type: 'observation',
    body: { text: `entry ${id}` },
    locked: false,
    created_at: new Date().toISOString(),
    ...over,
});

function renderRoom(path = '/rooms/5') {
    return render(
        <MemoryRouter initialEntries={[path]}>
            <ToastProvider>
                <Routes>
                    <Route path="/rooms/:roomId" element={<RoomDetailsPage />} />
                </Routes>
            </ToastProvider>
        </MemoryRouter>,
    );
}

const timelineTexts = () =>
    within(screen.getByRole('list', { name: 'Timeline' }))
        .getAllByRole('listitem')
        .map((li) => li.querySelector('.timeline__body')?.textContent);

let socket: ReturnType<typeof fakeSocket>;

beforeEach(() => {
    for (const fn of [getIncident, listTimeline, postTimelineEntry, resolveIncident, requestAiDraft, confirmAiDraft, rejectAiDraft]) {
        vi.mocked(fn).mockReset();
    }
    socket = fakeSocket();
    vi.mocked(connectSocket).mockReset().mockReturnValue(socket);
});

describe('RoomDetailsPage', () => {
    it('orders the timeline by entry id even when rows arrive out of order', async () => {
        vi.mocked(getIncident).mockResolvedValue(incident());
        vi.mocked(listTimeline).mockResolvedValue([entry(3), entry(1), entry(2)]);
        renderRoom();

        expect(await screen.findByRole('heading', { name: 'VPN drops' })).toBeTruthy();
        expect(timelineTexts()).toEqual(['entry 1', 'entry 2', 'entry 3']);
    });

    it('labels authors as You, a teammate by id, or System', async () => {
        // sub is signed as a string (ADR 0005); this user is #9
        setAccessToken(`h.${btoa(JSON.stringify({ sub: '9' })).replace(/=+$/, '')}.s`);
        vi.mocked(getIncident).mockResolvedValue(incident());
        vi.mocked(listTimeline).mockResolvedValue([
            entry(1, { author_id: 9 }),
            entry(2, { author_id: 4 }),
            entry(3, { author_id: null, type: 'system', body: { text: 'Room opened' } }),
        ]);
        renderRoom();

        const list = await screen.findByRole('list', { name: 'Timeline' });
        const authors = [...list.querySelectorAll('.timeline__author')].map((el) => el.textContent);
        expect(authors).toEqual(['You', 'User #4', 'System']);
    });

    it('lays out an AI draft as summary, why it matters, and likely fix', async () => {
        vi.mocked(getIncident).mockResolvedValue(incident());
        vi.mocked(listTimeline).mockResolvedValue([
            entry(1, { author_id: null, type: 'ai_draft', body: { summary: 'S', why_it_matters: 'W', likely_fix: 'F' } }),
        ]);
        renderRoom();

        expect(await screen.findByText('Likely fix')).toBeTruthy();
        expect(screen.getByText('Awaiting confirmation')).toBeTruthy();
        expect(screen.getByText('F')).toBeTruthy();
    });

    it('shows not found for a 404, without saying whether the room exists elsewhere', async () => {
        vi.mocked(getIncident).mockRejectedValue(new ApiError(404, 'not_found', 'Incident not found'));
        vi.mocked(listTimeline).mockResolvedValue([]);
        renderRoom();

        expect(await screen.findByText('Room not found')).toBeTruthy();
        expect(screen.getByRole('link', { name: 'Back to rooms' }).getAttribute('href')).toBe('/rooms');
    });

    it('treats a non-numeric id as not found without calling the server', async () => {
        renderRoom('/rooms/ROOM-0001');

        expect(await screen.findByText('Room not found')).toBeTruthy();
        expect(getIncident).not.toHaveBeenCalled();
    });

    it('posts an entry as { text } and merges the stored row into the timeline in id order', async () => {
        vi.mocked(getIncident).mockResolvedValue(incident());
        vi.mocked(listTimeline).mockResolvedValue([entry(1)]);
        vi.mocked(postTimelineEntry).mockResolvedValue(entry(2, { type: 'action', body: { text: 'Restarted the VPN' } }));
        renderRoom();

        user.selectOptions(await screen.findByLabelText('Entry type'), 'action');
        user.type(screen.getByLabelText('What happened?'), '  Restarted the VPN ');
        user.click(screen.getByRole('button', { name: 'Post to timeline' }));

        expect(postTimelineEntry).toHaveBeenCalledWith(5, { type: 'action', body: { text: 'Restarted the VPN' } });
        expect(await screen.findByText('Restarted the VPN')).toBeTruthy();
        expect(timelineTexts()).toEqual(['entry 1', 'Restarted the VPN']);
        expect((screen.getByLabelText('What happened?') as HTMLTextAreaElement).value).toBe('');
    });

    it('shows the post as sending while in flight, then swaps it for the stored entry', async () => {
        vi.mocked(getIncident).mockResolvedValue(incident());
        vi.mocked(listTimeline).mockResolvedValue([entry(1)]);
        let finish: (e: TimelineEntry) => void = () => {};
        vi.mocked(postTimelineEntry).mockReturnValue(new Promise<TimelineEntry>((resolve) => (finish = resolve)));
        renderRoom();

        user.type(await screen.findByLabelText('What happened?'), 'On my way');
        user.click(screen.getByRole('button', { name: 'Post to timeline' }));

        const sending = await waitFor(() => {
            const li = document.querySelector('.timeline__entry--sending');
            expect(li).not.toBeNull();
            return li!;
        });
        expect(sending.textContent).toContain('On my way');

        await act(async () => finish(entry(2, { body: { text: 'On my way' } })));

        expect(document.querySelector('.timeline__entry--sending')).toBeNull();
        expect(timelineTexts()).toEqual(['entry 1', 'On my way']);
    });

    it('drops the sending row when the post fails', async () => {
        vi.mocked(getIncident).mockResolvedValue(incident());
        vi.mocked(listTimeline).mockResolvedValue([entry(1)]);
        vi.mocked(postTimelineEntry).mockRejectedValue(new ApiError(500, 'unknown', 'Database unavailable'));
        renderRoom();

        user.type(await screen.findByLabelText('What happened?'), 'Lost');
        user.click(screen.getByRole('button', { name: 'Post to timeline' }));

        expect(await screen.findByText('Database unavailable')).toBeTruthy();
        expect(document.querySelector('.timeline__entry--sending')).toBeNull();
        expect(timelineTexts()).toEqual(['entry 1']);
    });

    it('does not post an empty entry', async () => {
        vi.mocked(getIncident).mockResolvedValue(incident());
        vi.mocked(listTimeline).mockResolvedValue([]);
        renderRoom();

        user.click(await screen.findByRole('button', { name: 'Post to timeline' }));

        expect(screen.getByText('Write something first')).toBeTruthy();
        expect(postTimelineEntry).not.toHaveBeenCalled();
    });

    it('resolves the room from the server response and hides the button', async () => {
        vi.mocked(getIncident).mockResolvedValue(incident());
        vi.mocked(listTimeline).mockResolvedValue([]);
        vi.mocked(resolveIncident).mockResolvedValue(
            incident({ status: 'resolved', resolved_at: new Date().toISOString() }),
        );
        renderRoom();

        user.click(await screen.findByRole('button', { name: 'Mark resolved' }));

        expect(resolveIncident).toHaveBeenCalledWith(5);
        expect(await screen.findByText('Resolved', { selector: '.ui-badge' })).toBeTruthy();
        expect(screen.queryByRole('button', { name: 'Mark resolved' })).toBeNull();
    });

    it('goes live and shows a teammate entry broadcast into the room', async () => {
        vi.mocked(getIncident).mockResolvedValue(incident());
        vi.mocked(listTimeline).mockResolvedValue([entry(1)]);
        renderRoom();

        expect(await screen.findByText('Connecting')).toBeTruthy();
        act(() => {
            socket.serverEmit('connect');
            socket.serverEmit('send-history', [], vi.fn());
            socket.serverEmit('new-message', entry(2, { author_id: 4, body: { text: 'Seeing it on my machine too' } }));
        });

        expect(screen.getByText('Live')).toBeTruthy();
        expect(timelineTexts()).toEqual(['entry 1', 'Seeing it on my machine too']);
        expect(screen.getByText('New observation in the timeline')).toBeTruthy();
    });

    // getRelevance is the real fixture here (not mocked), so this is the page wiring end to end
    it('shows a tagged relevance line under every entry', async () => {
        vi.mocked(getIncident).mockResolvedValue(incident());
        vi.mocked(listTimeline).mockResolvedValue([entry(1), entry(2), entry(3)]);
        renderRoom();

        await waitFor(() => expect(document.querySelectorAll('.timeline__relevance')).toHaveLength(3));
        expect(screen.getAllByText('sample')).toHaveLength(3);
    });

    it('never opens a socket for a room that does not exist', async () => {
        vi.mocked(getIncident).mockRejectedValue(new ApiError(404, 'not_found', 'Incident not found'));
        vi.mocked(listTimeline).mockResolvedValue([]);
        renderRoom();

        await screen.findByText('Room not found');
        expect(connectSocket).not.toHaveBeenCalled();
    });

    describe('AI drafts', () => {
        const DRAFT = { summary: 'VPN keeps dropping', why_it_matters: 'Nobody can reach staging', likely_fix: 'Raise the keepalive' };
        const draft = (id: number, over: Partial<TimelineEntry> = {}) =>
            entry(id, { type: 'ai_draft', author_id: null, body: DRAFT, ...over });

        const open = async (entries: TimelineEntry[]) => {
            vi.mocked(getIncident).mockResolvedValue(incident());
            vi.mocked(listTimeline).mockResolvedValue(entries);
            renderRoom();
            await screen.findByRole('heading', { name: 'VPN drops' });
        };

        it('requests a draft with the pasted text and kind, and shows it unconfirmed', async () => {
            await open([]);
            vi.mocked(requestAiDraft).mockResolvedValue(draft(1));

            user.selectOptions(screen.getByLabelText('What are you pasting?'), 'scanner');
            user.type(screen.getByLabelText('Output to explain'), '  ECONNRESET auth:4000  ');
            user.click(screen.getByRole('button', { name: 'Draft from context' }));

            expect(await screen.findByText('Raise the keepalive')).toBeTruthy();
            expect(requestAiDraft).toHaveBeenCalledWith(5, { context: 'ECONNRESET auth:4000', kind: 'scanner' });
            expect(screen.getByText('Awaiting confirmation')).toBeTruthy();
            expect(screen.getByRole('button', { name: 'Confirm AI draft 1' })).toBeTruthy();
            // a stale paste would invite a duplicate draft from the next click
            expect((screen.getByLabelText('Output to explain') as HTMLTextAreaElement).value).toBe('');
        });

        it('says it is working while a slow draft is in flight', async () => {
            await open([]);
            let finish: (e: TimelineEntry) => void = () => {};
            vi.mocked(requestAiDraft).mockReturnValue(new Promise<TimelineEntry>((resolve) => (finish = resolve)));

            user.type(screen.getByLabelText('Output to explain'), 'log');
            user.click(screen.getByRole('button', { name: 'Draft from context' }));

            expect(await screen.findByText('Drafting. This usually takes 10 to 20 seconds.')).toBeTruthy();

            finish(draft(1));
            await screen.findByText('Raise the keepalive');
            expect(screen.queryByText('Drafting. This usually takes 10 to 20 seconds.')).toBeNull();
        });

        it('does not ask for a draft with nothing pasted', async () => {
            await open([]);

            user.click(screen.getByRole('button', { name: 'Draft from context' }));

            expect(screen.getByText('Paste a log or scanner output first')).toBeTruthy();
            expect(requestAiDraft).not.toHaveBeenCalled();
        });

        it('says the provider did not answer on a 504 and keeps the paste for a retry', async () => {
            await open([]);
            vi.mocked(requestAiDraft).mockRejectedValue(
                new ApiError(504, 'upstream_error', 'Difficulty in responsiveness to the server'),
            );

            user.type(screen.getByLabelText('Output to explain'), 'some log');
            user.click(screen.getByRole('button', { name: 'Draft from context' }));

            expect(await screen.findByText("The AI provider didn't answer. Try again in a moment.")).toBeTruthy();
            expect((screen.getByLabelText('Output to explain') as HTMLTextAreaElement).value).toBe('some log');
        });

        // ADR 0014: confirming is what sets the author, and the type never changes
        it('confirms a draft: it becomes yours, keeps its AI draft badge, and loses its buttons', async () => {
            setAccessToken(`h.${btoa(JSON.stringify({ sub: '9' })).replace(/=+$/, '')}.s`);
            await open([draft(1)]);
            vi.mocked(confirmAiDraft).mockResolvedValue(draft(1, { author_id: 9 }));

            user.click(screen.getByRole('button', { name: 'Confirm AI draft 1' }));

            await waitFor(() => expect(screen.queryByRole('button', { name: 'Confirm AI draft 1' })).toBeNull());
            expect(confirmAiDraft).toHaveBeenCalledWith(5, 1);
            const list = screen.getByRole('list', { name: 'Timeline' });
            expect(within(list).getByText('You')).toBeTruthy();
            expect(within(list).getByText('AI draft')).toBeTruthy();
            expect(list.querySelector('.timeline__entry--pending')).toBeNull();
        });

        // confirm and reject race each other on the server; the screen must not send both
        it('disables both buttons while one request is in flight', async () => {
            await open([draft(1)]);
            let finish: (e: TimelineEntry) => void = () => {};
            vi.mocked(confirmAiDraft).mockReturnValue(new Promise<TimelineEntry>((resolve) => (finish = resolve)));

            user.click(screen.getByRole('button', { name: 'Confirm AI draft 1' }));

            await waitFor(() => expect((screen.getByRole('button', { name: 'Reject AI draft 1' }) as HTMLButtonElement).disabled).toBe(true));
            expect((screen.getByRole('button', { name: 'Confirm AI draft 1' }) as HTMLButtonElement).disabled).toBe(true);

            finish(draft(1, { author_id: 9 }));
            await waitFor(() => expect(screen.queryByRole('button', { name: 'Reject AI draft 1' })).toBeNull());
        });

        it('rejects a draft: it leaves the timeline', async () => {
            await open([entry(1), draft(2)]);
            vi.mocked(rejectAiDraft).mockResolvedValue(draft(2));

            user.click(screen.getByRole('button', { name: 'Reject AI draft 2' }));

            await waitFor(() => expect(timelineTexts()).toEqual(['entry 1']));
            expect(rejectAiDraft).toHaveBeenCalledWith(5, 2);
        });

        it('refetches the timeline when someone else already confirmed the draft', async () => {
            await open([draft(1)]);
            vi.mocked(confirmAiDraft).mockRejectedValue(new ApiError(409, 'already_approved', 'ai_draft entry was already approved'));
            vi.mocked(listTimeline).mockResolvedValue([draft(1, { author_id: 4 })]);

            user.click(screen.getByRole('button', { name: 'Confirm AI draft 1' }));

            expect(await screen.findByText('Someone already handled this draft. Showing the latest timeline.')).toBeTruthy();
            await waitFor(() => expect(listTimeline).toHaveBeenCalledTimes(2));
            expect(screen.getByText('User #4')).toBeTruthy();
            expect(screen.queryByRole('button', { name: 'Confirm AI draft 1' })).toBeNull();
        });

        it('drops a draft someone else rejected first instead of leaving a ghost', async () => {
            await open([entry(1), draft(2)]);
            vi.mocked(confirmAiDraft).mockRejectedValue(new ApiError(404, 'entry_not_found', 'No entry with that id'));
            vi.mocked(listTimeline).mockResolvedValue([entry(1)]);

            user.click(screen.getByRole('button', { name: 'Confirm AI draft 2' }));

            await waitFor(() => expect(timelineTexts()).toEqual(['entry 1']));
        });

        it('shows the draft once when it arrives by POST response and again over the socket', async () => {
            await open([]);
            vi.mocked(requestAiDraft).mockResolvedValue(draft(1));

            user.type(screen.getByLabelText('Output to explain'), 'log');
            user.click(screen.getByRole('button', { name: 'Draft from context' }));
            await screen.findByText('Raise the keepalive');
            act(() => socket.serverEmit('new-message', draft(1)));

            expect(screen.getAllByText('Raise the keepalive')).toHaveLength(1);
        });

        it("shows a teammate's confirmation arriving over the socket without a click", async () => {
            await open([draft(1)]);

            act(() => socket.serverEmit('confirm-draft', draft(1, { author_id: 4 })));

            expect(screen.queryByRole('button', { name: 'Confirm AI draft 1' })).toBeNull();
            expect(screen.getByText('User #4')).toBeTruthy();
        });
    });
});
