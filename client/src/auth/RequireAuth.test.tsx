/**
 * RequireAuth.test.tsx — the three states, and the reload case that motivates all of them.
 *
 * The guard exists because a hard reload empties the token store while the httpOnly refresh cookie
 * survives, so "no token" and "signed out" are not the same thing. These tests assert on what the
 * user ends up seeing — page, spinner, or sign-in — not on markup, so the planned UI overhaul
 * should not touch them.
 *
 * jsdom has no real cookie jar, so refresh() is mocked here. Proving the cookie actually rides
 * through the Vite proxy needs a real browser; that is Client E2E smoke (schedule.md, Post-MVP).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import RequireAuth from './RequireAuth';
import { setAccessToken } from './tokenStore';
import * as api from './api';

// the real router is kept rather than stubbed Navigate — the redirect is the behaviour under test
function renderGuarded(initialPath = '/rooms') {
    return render(
        <MemoryRouter initialEntries={[initialPath]}>
            <Routes>
                <Route path="/signin" element={<p>Sign in page</p>} />
                <Route
                    path="/rooms"
                    element={
                        <RequireAuth>
                            <p>Rooms page</p>
                        </RequireAuth>
                    }
                />
                <Route
                    path="/rooms/:id"
                    element={
                        <RequireAuth>
                            <p>Room details</p>
                        </RequireAuth>
                    }
                />
            </Routes>
        </MemoryRouter>
    );
}

let refreshMock: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
    refreshMock = vi.spyOn(api, 'refresh');
});

describe('RequireAuth', () => {
    // in-app navigation straight after login: the token is already in memory, so asking the server
    // again would be a pointless round trip on every single page change.
    it('renders immediately without a network call when a token is already held', async () => {
        setAccessToken('live-token');

        renderGuarded();

        expect(screen.getByText('Rooms page')).toBeTruthy();
        expect(refreshMock).not.toHaveBeenCalled();
    });

    // the reload case: memory is empty but the cookie is good, so the answer is not knowable yet
    it('shows the checking state while the session is still unknown', () => {
        refreshMock.mockReturnValue(new Promise(() => {})); // never settles

        renderGuarded();

        expect(screen.queryByText('Rooms page')).toBeNull();
        expect(screen.queryByText('Sign in page')).toBeNull();
        expect(screen.getByText(/checking your session/i)).toBeTruthy();
    });

    it('renders the page once the cookie is traded for a token', async () => {
        refreshMock.mockResolvedValue('recovered-token');

        renderGuarded();

        expect(await screen.findByText('Rooms page')).toBeTruthy();
        expect(refreshMock).toHaveBeenCalledTimes(1);
    });

    it('redirects to sign-in when there is no valid session', async () => {
        refreshMock.mockResolvedValue(null);

        renderGuarded();

        expect(await screen.findByText('Sign in page')).toBeTruthy();
        expect(screen.queryByText('Rooms page')).toBeNull();
    });

    // the done-criterion that says a deep link in a private window must redirect, not blank or crash
    it('redirects a deep link rather than rendering an empty page', async () => {
        refreshMock.mockResolvedValue(null);

        renderGuarded('/rooms/5');

        expect(await screen.findByText('Sign in page')).toBeTruthy();
        expect(screen.queryByText('Room details')).toBeNull();
    });

    // the guard must never show protected content before the answer arrives, even for one frame
    it('never flashes the page before the session resolves', async () => {
        let resolveRefresh: (token: string | null) => void = () => {};
        refreshMock.mockReturnValue(new Promise((r) => { resolveRefresh = r; }));

        renderGuarded();
        expect(screen.queryByText('Rooms page')).toBeNull();

        resolveRefresh('recovered-token');
        expect(await screen.findByText('Rooms page')).toBeTruthy();
    });
});
