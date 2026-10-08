/**
 * api.test.ts — the retry path, which is the one branch a browser cannot reach.
 *
 * ACCESS_TOKEN_TTL is 15m (server/src/constants/auth.ts), so reaching "token_expired" by clicking
 * means idling fifteen minutes with a tab open. Mocking fetch makes it a two-line setup, and makes
 * the distinction the whole design rests on — retry on token_expired, never on the other two 401s —
 * something a test can hold rather than something a reader has to notice.
 *
 * Error codes here are copied from server/src/auth/middleware.ts and were confirmed against the
 * running server through the Vite proxy; if those strings change, these tests are the tripwire.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiFetch, refresh, login, register, ApiError } from './api';
import { getAccessToken, setAccessToken } from './tokenStore';

// Response.json() is one-shot, so each call needs its own object — a shared one fails the second read.
const jsonResponse = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' }
    });

const authHeaderOf = (call: unknown[]) =>
    new Headers((call[1] as RequestInit).headers).get('Authorization');

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
});

describe('apiFetch', () => {
    it('attaches the stored token as a Bearer header', async () => {
        setAccessToken('stored-token');
        fetchMock.mockResolvedValueOnce(jsonResponse(200, { ok: true }));

        await apiFetch('/incidents');

        expect(authHeaderOf(fetchMock.mock.calls[0])).toBe('Bearer stored-token');
    });

    // a signed-out caller should still be able to make the request and get the server's own 401 back
    it('omits the header entirely when there is no token', async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse(200, { ok: true }));

        await apiFetch('/incidents');

        expect(authHeaderOf(fetchMock.mock.calls[0])).toBeNull();
    });

    it('returns a success straight through without touching refresh', async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse(200, { entries: [] }));

        const res = await apiFetch('/incidents');

        expect(res.status).toBe(200);
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    // THE test. Everything else in this file exists to pin the edges of this one behaviour.
    it('refreshes once and replays the request with the new token', async () => {
        setAccessToken('expired-token');
        fetchMock
            .mockResolvedValueOnce(jsonResponse(401, { error: 'token_expired' }))
            .mockResolvedValueOnce(jsonResponse(200, { accessToken: 'fresh-token' }))
            .mockResolvedValueOnce(jsonResponse(200, { entries: [] }));

        const res = await apiFetch('/incidents');

        expect(res.status).toBe(200);
        expect(fetchMock).toHaveBeenCalledTimes(3);
        expect(fetchMock.mock.calls[1][0]).toBe('/auth/refresh');
        // the replay carries the NEW token — replaying with the expired one would 401 forever
        expect(authHeaderOf(fetchMock.mock.calls[2])).toBe('Bearer fresh-token');
        expect(getAccessToken()).toBe('fresh-token');
    });

    it('surfaces the original 401 when the refresh itself fails', async () => {
        setAccessToken('expired-token');
        fetchMock
            .mockResolvedValueOnce(jsonResponse(401, { error: 'token_expired' }))
            .mockResolvedValueOnce(jsonResponse(401, { error: 'refresh_token_invalid' }));

        const res = await apiFetch('/incidents');

        expect(res.status).toBe(401);
        // no third call: one refresh attempt, no replay, no loop
        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(getAccessToken()).toBeNull();
    });

    // the distinction status alone cannot make. Refreshing here would be a wasted round trip
    // against a session that never existed.
    it.each(['token_missing', 'token_invalid'])(
        'does not refresh on a 401 that is %s',
        async (code) => {
            fetchMock.mockResolvedValueOnce(jsonResponse(401, { error: code }));

            const res = await apiFetch('/incidents');

            expect(res.status).toBe(401);
            expect(fetchMock).toHaveBeenCalledTimes(1);
        }
    );

    it('passes a non-401 error back untouched', async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse(404, { error: 'incident_not_found' }));

        const res = await apiFetch('/incidents/999');

        expect(res.status).toBe(404);
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    // res.clone() before reading is what makes this possible — reading the body to check the error
    // code would otherwise consume it and hand the caller an already-drained Response.
    it('leaves the returned body readable after inspecting the error code', async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse(401, { error: 'token_invalid' }));

        const res = await apiFetch('/incidents');

        await expect(res.json()).resolves.toEqual({ error: 'token_invalid' });
    });

    it('retries at most once, so a still-401 replay does not loop', async () => {
        setAccessToken('expired-token');
        fetchMock
            .mockResolvedValueOnce(jsonResponse(401, { error: 'token_expired' }))
            .mockResolvedValueOnce(jsonResponse(200, { accessToken: 'fresh-token' }))
            .mockResolvedValueOnce(jsonResponse(401, { error: 'token_expired' }));

        const res = await apiFetch('/incidents');

        expect(res.status).toBe(401);
        expect(fetchMock).toHaveBeenCalledTimes(3);
    });
});

describe('refresh', () => {
    // no Authorization header on purpose: handleRefresh reads req.cookies.refreshToken and nothing
    // else, and the token we would send is the one that just failed.
    it('posts to /auth/refresh without an Authorization header', async () => {
        setAccessToken('expired-token');
        fetchMock.mockResolvedValueOnce(jsonResponse(200, { accessToken: 'fresh-token' }));

        await refresh();

        expect(fetchMock.mock.calls[0][0]).toBe('/auth/refresh');
        expect((fetchMock.mock.calls[0][1] as RequestInit).method).toBe('POST');
        expect(new Headers((fetchMock.mock.calls[0][1] as RequestInit)?.headers).get('Authorization')).toBeNull();
    });

    it('stores the new token itself so callers cannot forget to', async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse(200, { accessToken: 'fresh-token' }));

        await expect(refresh()).resolves.toBe('fresh-token');
        expect(getAccessToken()).toBe('fresh-token');
    });

    it('clears the token and reports no session on a rejected cookie', async () => {
        setAccessToken('stale-token');
        fetchMock.mockResolvedValueOnce(jsonResponse(401, { error: 'refresh_token_missing' }));

        await expect(refresh()).resolves.toBeNull();
        expect(getAccessToken()).toBeNull();
    });

    // a dead server must read as "no session", not as an unhandled rejection that blanks the guard
    it('treats a network failure as no session rather than throwing', async () => {
        setAccessToken('stale-token');
        fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));

        await expect(refresh()).resolves.toBeNull();
        expect(getAccessToken()).toBeNull();
    });
});

describe('login and register', () => {
    it.each([
        ['login', login, '/auth/login'],
        ['register', register, '/auth/register']
    ])('%s posts credentials and stores the returned token', async (_name, fn, path) => {
        fetchMock.mockResolvedValueOnce(jsonResponse(200, { accessToken: 'new-token' }));

        await expect(fn('a@b.com', 'password123')).resolves.toBe('new-token');
        expect(fetchMock.mock.calls[0][0]).toBe(path);
        expect(JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)).toEqual({
            email: 'a@b.com',
            password: 'password123'
        });
        expect(getAccessToken()).toBe('new-token');
    });

    // these two run before any token exists, so they must not carry the retry wrapper: a 401 here
    // means wrong password, and refreshing a session you never had cannot fix it.
    it('sends no Authorization header even when a token is somehow present', async () => {
        setAccessToken('leftover-token');
        fetchMock.mockResolvedValueOnce(jsonResponse(200, { accessToken: 'new-token' }));

        await login('a@b.com', 'password123');

        expect(authHeaderOf(fetchMock.mock.calls[0])).toBeNull();
    });

    it('raises invalid_credentials as an ApiError carrying the server message', async () => {
        fetchMock.mockResolvedValueOnce(
            jsonResponse(401, { error: 'invalid_credentials', message: 'Invalid email or password' })
        );

        await expect(login('a@b.com', 'wrongpass1')).rejects.toMatchObject({
            status: 401,
            code: 'invalid_credentials',
            message: 'Invalid email or password'
        });
        // a failed login must not leave a token behind
        expect(getAccessToken()).toBeNull();
    });

    it('raises email_taken on a duplicate registration', async () => {
        fetchMock.mockResolvedValueOnce(
            jsonResponse(409, { error: 'email_taken', message: 'An account with this email already exists' })
        );

        await expect(register('a@b.com', 'password123')).rejects.toBeInstanceOf(ApiError);
    });

    // validateBody's 400 puts a whole ZodError object in `message`. Rendering that verbatim shows
    // "[object Object]" to the user, so a non-string message has to fall back to readable text.
    it('does not surface a raw ZodError object as the message', async () => {
        fetchMock.mockResolvedValueOnce(
            jsonResponse(400, { error: 'Bad Request', message: { name: 'ZodError', issues: [] } })
        );

        await expect(login('a@b.com', 'short')).rejects.toMatchObject({
            status: 400,
            message: 'Check your email and password'
        });
    });

    it('still reports something readable when the error body is not JSON at all', async () => {
        fetchMock.mockResolvedValueOnce(new Response('<html>502</html>', { status: 502 }));

        await expect(login('a@b.com', 'password123')).rejects.toMatchObject({
            status: 502,
            code: 'unknown'
        });
    });
});
