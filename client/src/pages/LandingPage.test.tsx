/**
 * LandingPage.test.tsx — "/" sends a live session to Rooms and shows everyone else the landing page,
 * and the sign-up box hands the email to the register form. jsdom has no IntersectionObserver or
 * matchMedia, which Motion and the theme toggle read, so both are stubbed.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import HomeGate from './HomeGate';
import AuthForm from '../components/auth/AuthForm';
import { refresh } from '../auth/api';
import { setAccessToken } from '../auth/tokenStore';

vi.mock('../auth/api', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../auth/api')>()),
    refresh: vi.fn(),
}));

beforeEach(() => {
    vi.mocked(refresh).mockReset();
    vi.stubGlobal(
        'IntersectionObserver',
        class {
            observe() {}
            unobserve() {}
            disconnect() {}
            takeRecords() {
                return [];
            }
        },
    );
    vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }));
});

function renderHome() {
    return render(
        <MemoryRouter initialEntries={['/']}>
            <Routes>
                <Route path="/" element={<HomeGate />} />
                <Route path="/rooms" element={<p>rooms page</p>} />
                <Route path="/signin" element={<AuthForm />} />
            </Routes>
        </MemoryRouter>,
    );
}

describe('HomeGate', () => {
    it('sends a session already in memory straight to rooms, without a refresh call', async () => {
        setAccessToken('live');
        renderHome();
        expect(await screen.findByText('rooms page')).toBeTruthy();
        expect(refresh).not.toHaveBeenCalled();
    });

    it('sends a reload with a valid refresh cookie to rooms', async () => {
        vi.mocked(refresh).mockResolvedValue('fresh');
        renderHome();
        expect(await screen.findByText('rooms page')).toBeTruthy();
    });

    it('shows the landing page to a visitor with no session', async () => {
        vi.mocked(refresh).mockResolvedValue(null);
        renderHome();
        expect(await screen.findByRole('heading', { name: 'Catch the bug that never throws.' })).toBeTruthy();
        expect(screen.queryByText('rooms page')).toBeNull();
    });
});

describe('LandingPage', () => {
    async function landing() {
        vi.mocked(refresh).mockResolvedValue(null);
        renderHome();
        await screen.findByRole('heading', { name: 'Catch the bug that never throws.' });
    }

    it('has the navbar, the four stats, the features, how it works, teams, sign-up and footer', async () => {
        await landing();
        const sections = screen.getByRole('navigation', { name: 'Sections' });
        expect([...sections.querySelectorAll('a')].map((a) => a.textContent)).toEqual(['Features', 'How it works', 'Teams', 'Sign in']);
        expect(document.querySelectorAll('.landing-stats__item')).toHaveLength(4);
        expect(document.querySelectorAll('.landing-card')).toHaveLength(3);
        expect(document.querySelectorAll('.landing-step')).toHaveLength(5);
        expect(document.querySelectorAll('.landing-voice')).toHaveLength(4);
        expect(screen.getByRole('contentinfo').textContent).toContain('IncidentIOQ');
    });

    // there are no customers yet; the voices must never read as real quotes
    it('labels the team voices as illustrative and tags unfinished steps', async () => {
        await landing();
        expect(screen.getByText('Illustrative scenarios, not customer quotes.')).toBeTruthy();
        expect(screen.getAllByText('In development')).toHaveLength(2);
    });

    it('hands the sign-up email to the register form', async () => {
        await landing();
        fireEvent.change(screen.getByLabelText('Email'), { target: { value: '  dev@company.com ' } });
        fireEvent.click(screen.getByRole('button', { name: 'Create account' }));

        expect(await screen.findByRole('heading', { name: 'Create your account' })).toBeTruthy();
        expect((screen.getByLabelText('Email') as HTMLInputElement).value).toBe('dev@company.com');
    });

    it('sends "Open a war room" to sign-up, not sign-in', async () => {
        await landing();
        fireEvent.click(screen.getByRole('link', { name: 'Open a war room' }));
        expect(await screen.findByRole('heading', { name: 'Create your account' })).toBeTruthy();
    });
});
