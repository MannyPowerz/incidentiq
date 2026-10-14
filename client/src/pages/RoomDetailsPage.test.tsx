/**
 * RoomDetailsPage.test.tsx — one room against a mocked api module. The ordering test is the one
 * that matters most: the timeline is sorted by entry id (ADR 0001), whatever order rows arrive in.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ToastProvider } from '../components/ui';
import RoomDetailsPage from './RoomDetailsPage';
import { ApiError, getIncident, listTimeline, postTimelineEntry, resolveIncident } from '../api';
import type { Incident, TimelineEntry } from '../api';
import { setAccessToken } from '../auth/tokenStore';

vi.mock('../api', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../api')>()),
    getIncident: vi.fn(),
    listTimeline: vi.fn(),
    postTimelineEntry: vi.fn(),
    resolveIncident: vi.fn(),
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

beforeEach(() => {
    for (const fn of [getIncident, listTimeline, postTimelineEntry, resolveIncident]) vi.mocked(fn).mockReset();
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
});
