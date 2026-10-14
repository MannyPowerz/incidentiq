/**
 * HomeGate — what "/" shows. A live session goes straight to Rooms; anyone else gets the landing
 * page. Same three states as RequireAuth, for the same reason: after a reload the token is gone
 * from memory but the refresh cookie may still be valid, so the answer takes one round trip.
 *
 * The landing page (and Motion with it) is lazy, so signed-in users never download it.
 */

import { Component, Suspense, lazy, useEffect, useState } from 'react';
import type { JSX, ReactNode } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { getAccessToken } from '../auth/tokenStore';
import { refresh } from '../auth/api';

const LandingPage = lazy(() => import('./LandingPage'));

type Status = 'checking' | 'authed' | 'anonymous';

/**
 * A lazy chunk that fails to load (a deploy that replaced it mid-visit, a dropped connection, a stale
 * dev cache) would otherwise blank the whole page. This keeps the visitor one click from somewhere real.
 */
class LandingBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
    state = { failed: false };

    static getDerivedStateFromError() {
        return { failed: true };
    }

    render() {
        if (!this.state.failed) return this.props.children;
        return (
            <main className="landing-fallback">
                <h1>IncidentIOQ</h1>
                <p>This page didn't finish loading.</p>
                <p>
                    <a href="/">Reload</a> or <Link to="/signin">go to sign in</Link>.
                </p>
            </main>
        );
    }
}

export default function HomeGate(): JSX.Element | null {
    const [status, setStatus] = useState<Status>(() => (getAccessToken() ? 'authed' : 'checking'));

    useEffect(() => {
        if (status !== 'checking') return;
        let cancelled = false;
        refresh().then((token) => {
            if (!cancelled) setStatus(token ? 'authed' : 'anonymous');
        });
        return () => {
            cancelled = true;
        };
    }, [status]);

    if (status === 'authed') return <Navigate to="/rooms" replace />;
    // one refresh round trip; rendering nothing avoids flashing the landing page at a signed-in user
    if (status === 'checking') return null;
    return (
        <LandingBoundary>
            <Suspense fallback={null}>
                <LandingPage />
            </Suspense>
        </LandingBoundary>
    );
}
