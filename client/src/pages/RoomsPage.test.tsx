/**
 * RoomsPage.test.tsx — the triage board against a mocked api module: all its states, the three
 * groups and their order, the filters, and create.
 * The api functions are mocked rather than fetch, because api.test.ts already covers the wire.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ToastProvider } from '../components/ui';
import RoomsPage, { ATTENTION_CARDS } from './RoomsPage';
import { ApiError, createIncident, listIncidents } from '../api';
import type { Incident } from '../api';

vi.mock('../api', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../api')>()),
    listIncidents: vi.fn(),
    createIncident: vi.fn(),
}));

// fireEvent, not user-event: no new dependency for what three helpers cover
const user = {
    click: (el: Element) => fireEvent.click(el),
    type: (el: Element, value: string) => fireEvent.change(el, { target: { value } }),
    selectOptions: (el: Element, value: string) => fireEvent.change(el, { target: { value } }),
};

const incident = (over: Partial<Incident> = {}): Incident => ({
    id: 1,
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

function renderPage() {
    return render(
        <MemoryRouter>
            <ToastProvider>
                <RoomsPage />
            </ToastProvider>
        </MemoryRouter>,
    );
}

beforeEach(() => {
    vi.mocked(listIncidents).mockReset();
    vi.mocked(createIncident).mockReset();
});

describe('RoomsPage', () => {
    it('lists rooms with a real link to each, plus the open/P1/resolved summary', async () => {
        vi.mocked(listIncidents).mockResolvedValue([
            incident({ id: 7, title: 'Login 500s', severity: 'P1' }),
            incident({ id: 3, title: 'Old one', status: 'resolved' }),
        ]);
        renderPage();

        const link = await screen.findByRole('link', { name: /Login 500s/ });
        expect(link.getAttribute('href')).toBe('/rooms/7');
        expect(screen.getByLabelText('Summary').textContent).toBe('1 open, 1 at P1, 1 resolved');
    });

    it('puts open P1s first as cards, the other open rooms by severity, and folds resolved ones away', async () => {
        vi.mocked(listIncidents).mockResolvedValue([
            incident({ id: 9, title: 'Newest P3', severity: 'P3' }),
            incident({ id: 8, title: 'Fresh P1', severity: 'P1' }),
            incident({ id: 7, title: 'Older P2', severity: 'P2' }),
            incident({ id: 6, title: 'Done', severity: 'P1', status: 'resolved' }),
            incident({ id: 5, title: 'Written up', severity: 'P2', status: 'postmortem' }),
        ]);
        renderPage();

        const attention = await screen.findByRole('region', { name: 'Needs attention' });
        expect(within(attention).getAllByRole('link').map((l) => l.textContent)).toEqual([expect.stringContaining('Fresh P1')]);

        const open = screen.getByRole('region', { name: /^Open/ });
        expect(within(open).getAllByRole('link').map((l) => l.getAttribute('href'))).toEqual(['/rooms/7', '/rooms/9']);

        const finished = screen.getByText('Resolved', { selector: 'summary' }).closest('details')!;
        expect(finished.open).toBe(false);
        expect(within(finished).getAllByRole('link').map((l) => l.getAttribute('href'))).toEqual(['/rooms/6', '/rooms/5']);
    });

    it('caps the cards, and lets the rest of the open P1s lead the open list', async () => {
        const p1s = Array.from({ length: ATTENTION_CARDS + 2 }, (_, i) => incident({ id: 100 - i, title: `P1 number ${i}`, severity: 'P1' }));
        vi.mocked(listIncidents).mockResolvedValue([...p1s, incident({ id: 1, title: 'A P2', severity: 'P2' })]);
        renderPage();

        const attention = await screen.findByRole('region', { name: 'Needs attention' });
        expect(within(attention).getAllByRole('link')).toHaveLength(ATTENTION_CARDS);
        const open = within(screen.getByRole('region', { name: /^Open/ })).getAllByRole('link');
        expect(open.map((l) => l.getAttribute('href'))).toEqual(['/rooms/94', '/rooms/93', '/rooms/1']);
    });

    it('filters by severity and system, with counts on the chips, and clears back to everything', async () => {
        vi.mocked(listIncidents).mockResolvedValue([
            incident({ id: 3, title: 'Auth P1', severity: 'P1', affected_system: 'auth' }),
            incident({ id: 2, title: 'Auth P2', severity: 'P2', affected_system: 'auth' }),
            incident({ id: 1, title: 'Socket P2', severity: 'P2', affected_system: 'sockets' }),
        ]);
        renderPage();

        const p2 = await screen.findByRole('button', { name: 'P2 2' });
        user.click(p2);
        expect(p2.getAttribute('aria-pressed')).toBe('true');
        expect(screen.queryByRole('link', { name: /Auth P1/ })).toBeNull();
        expect(screen.getAllByRole('link', { name: /P2/ })).toHaveLength(2);
        // picking a severity leaves the other chips' counts alone, so you can see where else to look
        expect(screen.getByRole('button', { name: 'P1 1' })).toBeTruthy();

        user.selectOptions(screen.getByLabelText('System'), 'sockets');
        expect(screen.getAllByRole('link', { name: /P2/ }).map((l) => l.textContent)).toEqual([expect.stringContaining('Socket P2')]);
        // the chip counts follow the system filter, not the severity one
        expect(screen.getByRole('button', { name: 'P1 0' })).toBeTruthy();

        user.click(screen.getByRole('button', { name: 'P1 0' }));
        expect(screen.getByText('No P1 rooms in sockets.')).toBeTruthy();
        user.click(screen.getByRole('button', { name: 'Clear filters' }));
        expect(screen.getAllByRole('link', { name: /Auth|Socket/ })).toHaveLength(3);
    });

    it("shows the board's shape while loading", async () => {
        vi.mocked(listIncidents).mockReturnValue(new Promise(() => {}));
        renderPage();
        expect(screen.getByRole('status', { name: 'Loading rooms' })).toBeTruthy();
    });

    it('shows the empty state with a create action when the org has no rooms', async () => {
        vi.mocked(listIncidents).mockResolvedValue([]);
        renderPage();

        expect(await screen.findByText('No rooms yet')).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Create a room' })).toBeTruthy();
    });

    it('shows the server message on failure and loads on retry', async () => {
        vi.mocked(listIncidents)
            .mockRejectedValueOnce(new ApiError(0, 'network_error', "Can't reach the server."))
            .mockResolvedValueOnce([incident({ title: 'Back again' })]);
        renderPage();

        expect(await screen.findByText("Can't reach the server.")).toBeTruthy();
        user.click(screen.getByRole('button', { name: 'Try again' }));
        expect(await screen.findByRole('link', { name: /Back again/ })).toBeTruthy();
    });

    it('refuses to submit an incomplete room and says what is missing', async () => {
        vi.mocked(listIncidents).mockResolvedValue([]);
        renderPage();
        user.click(await screen.findByRole('button', { name: 'New room' }));
        user.click(screen.getByRole('button', { name: 'Create room' }));

        expect(screen.getByText('Give the room a title')).toBeTruthy();
        expect(screen.getByText('Choose a severity')).toBeTruthy();
        expect(screen.getByText('Choose the affected system')).toBeTruthy();
        expect(createIncident).not.toHaveBeenCalled();
    });

    // the stored row from the POST response goes to the top; the list is not refetched
    it('creates a room and puts it at the top without reloading the list', async () => {
        vi.mocked(listIncidents).mockResolvedValue([incident({ id: 1, title: 'Older' })]);
        vi.mocked(createIncident).mockResolvedValue(incident({ id: 2, title: 'Brand new' }));
        renderPage();

        user.click(await screen.findByRole('button', { name: 'New room' }));
        user.type(screen.getByLabelText('Title'), '  Brand new  ');
        user.selectOptions(screen.getByLabelText('Severity'), 'P1');
        user.selectOptions(screen.getByLabelText('Affected system'), 'sockets');
        user.click(screen.getByRole('button', { name: 'Create room' }));

        expect(createIncident).toHaveBeenCalledWith({ title: 'Brand new', severity: 'P1', affected_system: 'sockets' });
        await screen.findByRole('link', { name: /Brand new/ });
        expect(screen.getAllByRole('link')[0]?.textContent).toContain('Brand new');
        expect(screen.queryByRole('dialog')).toBeNull();
        expect(listIncidents).toHaveBeenCalledTimes(1);
    });

    it('keeps the dialog open with the server message when create fails', async () => {
        vi.mocked(listIncidents).mockResolvedValue([]);
        vi.mocked(createIncident).mockRejectedValue(new ApiError(500, 'unknown', 'Database unavailable'));
        renderPage();

        user.click(await screen.findByRole('button', { name: 'New room' }));
        user.type(screen.getByLabelText('Title'), 'x');
        user.selectOptions(screen.getByLabelText('Severity'), 'P3');
        user.selectOptions(screen.getByLabelText('Affected system'), 'auth');
        user.click(screen.getByRole('button', { name: 'Create room' }));

        expect(await screen.findByText('Database unavailable')).toBeTruthy();
        expect(screen.getByRole('dialog')).toBeTruthy();
    });

    it('pulses only open P1 rooms', async () => {
        vi.mocked(listIncidents).mockResolvedValue([
            incident({ id: 3, title: 'Open P1', severity: 'P1' }),
            incident({ id: 2, title: 'Resolved P1', severity: 'P1', status: 'resolved' }),
            incident({ id: 1, title: 'Open P2', severity: 'P2' }),
        ]);
        renderPage();

        const pulsing = async (title: string) =>
            (await screen.findByRole('link', { name: new RegExp(title) })).querySelector('.ui-livedot--failing') !== null;
        expect(await pulsing('Open P1')).toBe(true);
        expect(await pulsing('Resolved P1')).toBe(false);
        expect(await pulsing('Open P2')).toBe(false);
    });
});

