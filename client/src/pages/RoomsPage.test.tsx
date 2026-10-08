/**
 * RoomsPage.test.tsx — the rooms list against a mocked api module: all four states, and create.
 * The api functions are mocked rather than fetch, because api.test.ts already covers the wire.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ToastProvider } from '../components/ui';
import RoomsPage from './RoomsPage';
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
        const summary = screen.getByRole('region', { name: 'Summary' });
        expect(within(summary).getByText('Open').nextSibling?.textContent).toBe('1');
        expect(within(summary).getByText('P1 open').nextSibling?.textContent).toBe('1');
        expect(within(summary).getByText('Resolved').nextSibling?.textContent).toBe('1');
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
});
