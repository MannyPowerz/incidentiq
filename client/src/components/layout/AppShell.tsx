import { useState } from 'react';
import type { JSX } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { logout } from '../../auth/api';
import { Button, ThemeToggle, TopBar } from '../ui';
import type { TopBarLink } from '../ui';
import LiquidBackdrop from './LiquidBackdrop';
import './AppShell.css';

const LINKS: TopBarLink[] = [
    { to: '/rooms', label: 'Rooms' },
    { to: '/machines', label: 'Fingerprints' },
];

/**
 * AppShell — the frame around every signed-in page: the glass top bar, a skip link, and one <main>.
 * Mounted once as a layout route in App.tsx, so pages render content only and never their own chrome.
 */
export default function AppShell(): JSX.Element {
    const navigate = useNavigate();
    const { pathname } = useLocation();
    const [signingOut, setSigningOut] = useState(false);

    async function handleSignOut() {
        setSigningOut(true);
        await logout();
        navigate('/signin', { replace: true });
    }

    return (
        <div className="app-shell">
            {/* the liquid backdrop, subtle behind the app, so the glass top bar has color to refract */}
            <LiquidBackdrop intensity="subtle" />
            <a className="app-shell__skip" href="#main">
                Skip to content
            </a>
            <TopBar
                links={LINKS}
                right={
                    <>
                        <ThemeToggle />
                        <Button variant="ghost" size="sm" loading={signingOut} onClick={handleSignOut}>
                            Sign out
                        </Button>
                    </>
                }
            />
            <main id="main" className="app-shell__main" tabIndex={-1}>
                {/* keyed by path, so each page mounts fresh and plays the enter transition */}
                <div key={pathname} className="app-shell__page">
                    <Outlet />
                </div>
            </main>
        </div>
    );
}
