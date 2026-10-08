/**
 * tokenStore.ts — the one place the access token lives while the tab is open.
 *
 * A module-level variable, not React state: every importer shares the same value, and it
 * vanishes on reload — which is the point, nothing script-readable ever persists it.
 *   ↳ vs. Context — deferred: only RequireAuth reads this today, and nothing renders auth state
 *     yet (DashboardHeader is cut from Minimum, schedule.md). Lift to a Provider when something does.
 *   ↳ vs. localStorage/sessionStorage — rejected: both are readable by any injected script.
 *
 * Written by api.ts (login/register/refresh), read by apiFetch and RequireAuth.
 *
 * SECURITY: in-memory limits how long a stolen token stays useful; it does not stop a script
 * already running in this page from reading it. The real defence against that is keeping XSS out.
 */

let accessToken: string | null = null;

export function getAccessToken(): string | null {
    return accessToken;
}

// null is a real value here: a failed refresh or a future logout clears the session by setting it.
export function setAccessToken(token: string | null): void {
    accessToken = token;
}
