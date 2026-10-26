import { useState } from 'react';
import type { JSX } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { logout } from '../../auth/api';
import { Button, TopBar } from '../ui';
import type { TopBarLink } from '../ui';
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
    const [signingOut, setSigningOut] = useState(false);

    async function handleSignOut() {
        setSigningOut(true);
        await logout();
        navigate('/signin', { replace: true });
    }

    return (
        <div className="app-shell">
            {/* the sign-in mesh, carried faintly behind every signed-in page so the glass top bar has color to refract */}
            <div className="app-shell__mesh" aria-hidden="true">
                <span className="app-shell__blob app-shell__blob--1" />
                <span className="app-shell__blob app-shell__blob--2" />
                <span className="app-shell__blob app-shell__blob--3" />
            </div>
            <a className="app-shell__skip" href="#main">
                Skip to content
            </a>
            <TopBar
                links={LINKS}
                right={
                    <Button variant="ghost" size="sm" loading={signingOut} onClick={handleSignOut}>
                        Sign out
                    </Button>
                }
            />
            <main id="main" className="app-shell__main" tabIndex={-1}>
                <Outlet />
            </main>
        </div>
    );
}
