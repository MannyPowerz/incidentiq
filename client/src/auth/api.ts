/**
 * api.ts — every network call's auth in one place: attach the token, recover once from expiry.
 *
 * apiFetch wraps fetch so the "token aged out → refresh → retry" dance exists once instead of
 * in every page. login/register/refresh live beside it because they're the only calls that
 * run without a token, and they're where the token store gets written.
 *
 * Relies on the Vite proxy (vite.config.ts): the browser sees the API as same-origin, so the
 * httpOnly refresh cookie rides along under fetch's default credentials: 'same-origin'.
 *
 * TODO: decision — if client and API are ever served from different origins in production, this
 * file needs credentials: 'include', the server needs CORS with credentials, and the cookie's
 * sameSite: 'strict' (register.ts) has to change. That's a deploy-architecture call, not a patch.
 */

import { getAccessToken, setAccessToken } from './tokenStore';

// what requireAuth (server/src/auth/middleware.ts) sends when the token is merely old — the one
// 401 that refreshing can fix. token_missing and token_invalid share the status and must not retry.
const TOKEN_EXPIRED = 'token_expired';

// surfaces the server's { error, message } body as something a form can branch on
export class ApiError extends Error {
    readonly status: number;
    readonly code: string;

    constructor(status: number, code: string, message: string) {
        super(message);
        this.status = status;
        this.code = code;
    }
}

function withAuth(init: RequestInit, token: string | null): RequestInit {
    const headers = new Headers(init.headers);
    if (token) headers.set('Authorization', `Bearer ${token}`);
    return { ...init, headers };
}

/**
 * Authenticated fetch. Returns the Response like fetch does — no throwing on HTTP errors.
 * On 401 token_expired it refreshes once and re-sends; any other 401 comes back untouched so the
 * caller sees the real reason. A JSON string body re-sends fine; a stream body would not (none exist yet).
 */
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
    const res = await fetch(path, withAuth(init, getAccessToken()));
    if (res.status !== 401) return res;

    // clone: reading the body consumes it, and the caller still gets this Response if we don't retry
    const body = await res.clone().json().catch(() => null);
    if (body?.error !== TOKEN_EXPIRED) return res;

    // TODO: decision — N calls expiring together fire N refreshes. Share one in-flight promise if
    // that shows up in the Network tab once pages make parallel calls.
    const fresh = await refresh();
    if (!fresh) return res;

    // raw fetch, not apiFetch: a recursive call would need a retry counter; this cannot loop
    return fetch(path, withAuth(init, fresh));
}

/**
 * Trades the httpOnly cookie for a new access token. No Authorization header on purpose —
 * handleRefresh reads req.cookies.refreshToken and nothing else.
 * Never throws: a network failure is "no session" as far as the guard is concerned.
 *
 * SECURITY: the server hands back a new access token but keeps the same refresh cookie
 * (refresh.ts skips rotation). A stolen cookie therefore works until it expires, with no reuse
 * detection. Rotation + reuse detection is the upgrade; it's a server change and an ADR.
 */
export async function refresh(): Promise<string | null> {
    const res = await fetch('/auth/refresh', { method: 'POST' }).catch(() => null);
    if (!res?.ok) {
        setAccessToken(null);
        return null;
    }
    const { accessToken } = (await res.json()) as { accessToken: string };
    setAccessToken(accessToken);
    return accessToken;
}

// login and register share a body, a response shape, and the store write — one helper, two names
async function postCredentials(path: string, email: string, password: string): Promise<string> {
    const res = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string; message?: unknown } | null;
        // validateBody's 400 puts a raw ZodError in message; anything non-string gets a plain fallback
        const message = typeof body?.message === 'string' ? body.message : 'Check your email and password';
        throw new ApiError(res.status, body?.error ?? 'unknown', message);
    }

    const { accessToken } = (await res.json()) as { accessToken: string };
    setAccessToken(accessToken);
    return accessToken;
}

export function login(email: string, password: string): Promise<string> {
    return postCredentials('/auth/login', email, password);
}

export function register(email: string, password: string): Promise<string> {
    return postCredentials('/auth/register', email, password);
}
