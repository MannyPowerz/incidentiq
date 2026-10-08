/**
 * RequireAuth.tsx — the route guard: render-or-redirect for every page except sign-in.
 *
 * Three states, not a boolean: after a reload the token is gone from memory but the refresh
 * cookie may still be valid, so the answer isn't known until one refresh() round-trip settles.
 *   ↳ vs. a Provider owning this check — deferred along with Context (see tokenStore.ts).
 *
 * Wraps the protected <Route element>s in App.tsx.
 */

import { useEffect, useState } from 'react';
import type { JSX } from 'react';
import { Navigate } from 'react-router-dom';
import { getAccessToken } from './tokenStore';
import { refresh } from './api';

type AuthStatus = 'checking' | 'authed' | 'anonymous';

export default function RequireAuth({ children }: { children: JSX.Element }): JSX.Element {
    // a token already in memory means in-app navigation, not a reload — skip the network round-trip
    const [status, setStatus] = useState<AuthStatus>(() => (getAccessToken() ? 'authed' : 'checking'));

    useEffect(() => {
        if (status !== 'checking') return;

        // StrictMode runs this effect twice in dev; the flag stops the abandoned first run from setting state
        let cancelled = false;
        refresh().then((token) => {
            if (!cancelled) setStatus(token ? 'authed' : 'anonymous');
        });
        return () => {
            cancelled = true;
        };
    }, [status]);

    if (status === 'checking') return <p className="auth-checking">Checking your session…</p>;

    // replace: keep the blocked URL out of history so Back doesn't bounce into this redirect again
    // TODO: decision — pass the blocked location in state so sign-in can return the user to it afterwards
    if (status === 'anonymous') return <Navigate to="/signin" replace />;

    return children;
}
