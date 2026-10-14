/**
 * FingerprintsPage.test.tsx — the comparison against a mocked api module. What matters is that
 * exactly the values differing from the baseline machine are flagged, and that migrations name
 * what is missing rather than only saying "different".
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import FingerprintsPage from './FingerprintsPage';
import { ApiError, listFingerprints } from '../api';
import type { FingerprintWithPublisher } from '../api';

vi.mock('../api', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../api')>()),
    listFingerprints: vi.fn(),
}));

const fp = (id: number, over: Partial<FingerprintWithPublisher> = {}): FingerprintWithPublisher => ({
    id,
    user_id: id,
    project_id: 'incidentiq',
    node_version: '22.11.0',
    os_arch: 'darwin-arm64',
    lockfile_hash: 'a3f9c2e81b7d4f60e2c1',
    applied_migrations: ['0001_orgs_users.sql', '0002_incidents_timeline.sql'],
    updated_at: new Date().toISOString(),
    published_by: `user${id}@example.com`,
    ...over,
});

function Where() {
    const { search } = useLocation();
    return <p data-testid="search">{search}</p>;
}

function renderPage(path = '/machines') {
    return render(
        <MemoryRouter initialEntries={[path]}>
            <Routes>
                <Route path="/machines" element={<><FingerprintsPage /><Where /></>} />
            </Routes>
        </MemoryRouter>,
    );
}

// the differing cells, as "<field> | <column header>" pairs, read straight from the rendered table
const diffs = () =>
    [...document.querySelectorAll('.fp-cell--diff')].map((cell) => {
        const td = cell.closest('td')!;
        const field = td.parentElement!.querySelector('td')!.textContent;
        return `${field} | ${td.getAttribute('data-label')}`;
    });

beforeEach(() => vi.mocked(listFingerprints).mockReset());

describe('FingerprintsPage', () => {
    it('defaults to the incidentiq project and shows one column per machine, the first as baseline', async () => {
        vi.mocked(listFingerprints).mockResolvedValue([fp(1), fp(2)]);
        renderPage();

        expect(await screen.findByRole('columnheader', { name: 'user1@example.com (baseline)' })).toBeTruthy();
        expect(screen.getByRole('columnheader', { name: 'user2@example.com' })).toBeTruthy();
        expect(listFingerprints).toHaveBeenCalledWith('incidentiq');
    });

    it('flags exactly the cells that differ from the baseline, and summarises them', async () => {
        vi.mocked(listFingerprints).mockResolvedValue([
            fp(1),
            fp(2, { node_version: '20.18.1' }),
            fp(3, { lockfile_hash: 'ffffffffffffffffffff' }),
        ]);
        renderPage();

        await screen.findByText(/2 of 4 fields differ across 3 machines/);
        expect(diffs()).toEqual(['Node version | user2@example.com', 'Lockfile hash | user3@example.com']);
        expect(screen.getByText(/Node version, Lockfile hash/)).toBeTruthy();
    });

    it('treats the same migrations in a different order as a match', async () => {
        vi.mocked(listFingerprints).mockResolvedValue([
            fp(1),
            fp(2, { applied_migrations: ['0002_incidents_timeline.sql', '0001_orgs_users.sql'] }),
        ]);
        renderPage();

        expect(await screen.findByText('All 2 machines match.')).toBeTruthy();
        expect(diffs()).toEqual([]);
    });

    it('names the migration a machine is missing and the one it has extra', async () => {
        vi.mocked(listFingerprints).mockResolvedValue([
            fp(1),
            fp(2, { applied_migrations: ['0001_orgs_users.sql', '0006_agent_keys.sql'] }),
        ]);
        renderPage();

        await screen.findByText(/1 of 4 fields differ/);
        const missing = document.querySelector('.fp-list__missing')!;
        const extra = document.querySelector('.fp-list__extra')!;
        expect(missing.textContent).toBe('0002_incidents_timeline.sqlmissing');
        expect(extra.textContent).toBe('0006_agent_keys.sqlextra');
    });

    it('says "not reported" for a null field and counts it as a difference', async () => {
        vi.mocked(listFingerprints).mockResolvedValue([fp(1), fp(2, { os_arch: null })]);
        renderPage();

        expect(await screen.findByText('not reported')).toBeTruthy();
        expect(diffs()).toEqual(['OS / arch | user2@example.com']);
    });

    it('shortens a long lockfile hash but keeps the full value in the page', async () => {
        vi.mocked(listFingerprints).mockResolvedValue([fp(1)]);
        renderPage();

        const hash = await screen.findByTitle('a3f9c2e81b7d4f60e2c1');
        expect(hash.querySelector('.fp-hash__short')!.textContent).toBe('a3f9c2e81b7d…');
        expect(hash.querySelector('.fp-hash__full')!.textContent).toBe('a3f9c2e81b7d4f60e2c1');
        expect(hash.getAttribute('tabindex')).toBe('0');
    });

    it('says there is nothing to compare with only one machine', async () => {
        vi.mocked(listFingerprints).mockResolvedValue([fp(1)]);
        renderPage();

        expect(await screen.findByText('Only one machine has published, so there is nothing to compare yet.')).toBeTruthy();
    });

    it('shows the empty state with the agent setting to use', async () => {
        vi.mocked(listFingerprints).mockResolvedValue([]);
        renderPage('/machines?project=payments');

        expect(await screen.findByText('Nobody has published for this project yet')).toBeTruthy();
        expect(screen.getByText(/AGENT_PROJECT_ID=payments/)).toBeTruthy();
    });

    it('shows the server message on failure and loads on retry', async () => {
        vi.mocked(listFingerprints)
            .mockRejectedValueOnce(new ApiError(0, 'network_error', "Can't reach the server."))
            .mockResolvedValueOnce([fp(1)]);
        renderPage();

        expect(await screen.findByText("Can't reach the server.")).toBeTruthy();
        fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
        expect(await screen.findByText(/Only one machine/)).toBeTruthy();
    });

    it('compares another project from the form and puts it in the URL', async () => {
        vi.mocked(listFingerprints).mockResolvedValue([fp(1)]);
        renderPage();
        await screen.findByText(/Only one machine/);

        fireEvent.change(screen.getByLabelText('Project'), { target: { value: '  payments  ' } });
        fireEvent.click(screen.getByRole('button', { name: 'Compare' }));

        await waitFor(() => expect(listFingerprints).toHaveBeenLastCalledWith('payments'));
        expect(screen.getByTestId('search').textContent).toBe('?project=payments');
    });
});
