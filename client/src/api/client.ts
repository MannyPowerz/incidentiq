/**
 * client.ts — the one request function every module in api/ goes through.
 *
 * Built on apiFetch (client/src/auth/api.ts), which attaches the bearer token and refreshes once on
 * token_expired. This adds the other half: every failure becomes an ApiError with a code a screen
 * can branch on and a message it can render — including a network failure, which fetch reports as
 * a bare TypeError rather than a response.
 */

import { apiFetch, ApiError } from '../auth/api';

export { ApiError };

// what "the server is unreachable" looks like to a screen: a code, not an exception type to sniff
export const NETWORK_ERROR = 'network_error';

const FALLBACK_MESSAGE = 'Something went wrong. Try again.';

export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    let res: Response;
    try {
        res = await apiFetch(path, init);
    } catch {
        throw new ApiError(0, NETWORK_ERROR, "Can't reach the server. Check your connection and try again.");
    }

    // a non-JSON body (a proxy's HTML error page, an empty 204) reads as null rather than throwing
    const data: unknown = await res.json().catch(() => null);

    if (!res.ok) {
        const body = data as { error?: unknown; message?: unknown } | null;
        const code = typeof body?.error === 'string' ? body.error : 'unknown';
        // validateBody's 400 puts a whole ZodError object in `message`; a screen must never receive that
        const message = typeof body?.message === 'string' ? body.message : FALLBACK_MESSAGE;
        throw new ApiError(res.status, code, message);
    }

    return data as T;
}

export function jsonInit(method: string, body: unknown): RequestInit {
    return {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    };
}
