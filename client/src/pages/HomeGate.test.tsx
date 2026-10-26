/**
 * HomeGate.test.tsx — if the landing chunk fails to load, the visitor gets a way forward instead of
 * a blank page. Simulated by a landing module that throws when rendered.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import HomeGate from './HomeGate';

vi.mock('../auth/api', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../auth/api')>()),
    refresh: vi.fn().mockResolvedValue(null),
}));
vi.mock('./LandingPage', () => ({
    default: () => {
        throw new Error('Failed to fetch dynamically imported module');
    },
}));

describe('HomeGate', () => {
    it('shows a reload and sign-in fallback when the landing page fails to load', async () => {
        const quiet = vi.spyOn(console, 'error').mockImplementation(() => {});
        render(
            <MemoryRouter>
                <HomeGate />
            </MemoryRouter>,
        );

        expect(await screen.findByText("This page didn't finish loading.")).toBeTruthy();
        expect(screen.getByRole('link', { name: 'go to sign in' }).getAttribute('href')).toBe('/signin');
        quiet.mockRestore();
    });
});
