import { useState } from 'react';
import type { JSX } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { logout } from '../../auth/api';
import { Button, TopBar } from '../ui';
import type { TopBarLink } from '../ui';
import './AppShell.css';

// Item 7 adds Fingerprints here
const LINKS: TopBarLink[] = [{ to: '/rooms', label: 'Rooms' }];

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
