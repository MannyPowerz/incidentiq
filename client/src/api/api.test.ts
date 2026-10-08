/**
 * api.test.ts — every function hits the right path with the right method and body, and unwraps the
 * right key. The unwrapping is the part that silently breaks: most routes wrap ({ incident },
 * { entries }), but confirm, reject, and ai-draft return the bare row. Getting that backwards
 * returns undefined to a screen with no error anywhere.
 *
 * Response shapes copied from the server route handlers, read 2026-10-08.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    ApiError,
    NETWORK_ERROR,
    confirmAiDraft,
    createIncident,
    getIncident,
    getRelevance,
    listFingerprints,
    listIncidents,
    listTimeline,
    postTimelineEntry,
    readAiDraftBody,
    rejectAiDraft,
    requestAiDraft,
    resolveIncident,
} from './index';
import type { TimelineEntry } from './index';
import { setAccessToken } from '../auth/tokenStore';

const jsonResponse = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const entry = (over: Partial<TimelineEntry> = {}): TimelineEntry => ({
    id: 1,
    incident_id: 7,
    author_id: null,
    type: 'ai_draft',
    body: { summary: 's', why_it_matters: 'w', likely_fix: 'f' },
    locked: false,
    created_at: '2026-10-08T00:00:00.000Z',
    ...over,
});

let fetchMock: ReturnType<typeof vi.fn>;
const call = (n = 0) => ({
    path: fetchMock.mock.calls[n]?.[0] as string,
    init: (fetchMock.mock.calls[n]?.[1] ?? {}) as RequestInit,
});

beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    setAccessToken('live-token');
});

describe('request error mapping (client.ts)', () => {
    it('raises the server error code and message as an ApiError', async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse(404, { error: 'incident_not_found', message: 'No incident with that id' }));
        await expect(getIncident(99)).rejects.toMatchObject({
            status: 404,
            code: 'incident_not_found',
            message: 'No incident with that id',
        });
    });

    // validateBody's 400 carries a ZodError object in message; rendering it shows "[object Object]"
    it('replaces a non-string message with readable text', async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse(400, { error: 'Bad Request', message: { name: 'ZodError' } }));
        const err = await createIncident({ title: '', severity: 'P1' }).catch((e) => e);
        expect(err).toBeInstanceOf(ApiError);
        expect(typeof err.message).toBe('string');
        expect(err.message).not.toContain('object');
    });

    it('turns an unreachable server into a network_error code, not a raw TypeError', async () => {
        fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
        await expect(listIncidents()).rejects.toMatchObject({ status: 0, code: NETWORK_ERROR });
    });

    it('survives a non-JSON error body such as a proxy HTML page', async () => {
        fetchMock.mockResolvedValueOnce(new Response('<html>502</html>', { status: 502 }));
        await expect(listIncidents()).rejects.toMatchObject({ status: 502, code: 'unknown' });
    });

    it('sends the stored token on every call', async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse(200, { incidents: [] }));
        await listIncidents();
        expect(new Headers(call().init.headers).get('Authorization')).toBe('Bearer live-token');
    });
});

describe('incidents', () => {
    it('listIncidents unwraps { incidents }', async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse(200, { incidents: [{ id: 1 }, { id: 2 }] }));
        await expect(listIncidents()).resolves.toEqual([{ id: 1 }, { id: 2 }]);
        expect(call().path).toBe('/incidents');
    });

    it('getIncident unwraps { incident } from /incidents/:id', async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse(200, { incident: { id: 7 } }));
        await expect(getIncident(7)).resolves.toEqual({ id: 7 });
        expect(call().path).toBe('/incidents/7');
    });

    it('createIncident POSTs JSON and unwraps the 201', async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse(201, { incident: { id: 3, title: 'DB down' } }));
        const input = { title: 'DB down', severity: 'P1' as const, affected_system: 'postgres' };
        await expect(createIncident(input)).resolves.toEqual({ id: 3, title: 'DB down' });
        expect(call().path).toBe('/incidents');
        expect(call().init.method).toBe('POST');
        expect(new Headers(call().init.headers).get('Content-Type')).toBe('application/json');
        expect(JSON.parse(call().init.body as string)).toEqual(input);
    });

    // the only transition the server accepts; sending anything else is a guaranteed 400
    it('resolveIncident PATCHes status resolved', async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse(200, { incident: { id: 7, status: 'resolved' } }));
        await resolveIncident(7);
        expect(call().path).toBe('/incidents/7');
        expect(call().init.method).toBe('PATCH');
        expect(JSON.parse(call().init.body as string)).toEqual({ status: 'resolved' });
    });
});

describe('timeline', () => {
    it('listTimeline unwraps { entries } with no query by default', async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse(200, { entries: [entry()] }));
        await expect(listTimeline(7)).resolves.toHaveLength(1);
        expect(call().path).toBe('/incidents/7/timeline');
    });

    it('listTimeline passes since for gap-fill', async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse(200, { entries: [] }));
        await listTimeline(7, 42);
        expect(call().path).toBe('/incidents/7/timeline?since=42');
    });

    it('postTimelineEntry POSTs type and body and unwraps { entry }', async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse(201, { entry: entry({ id: 5, type: 'observation' }) }));
        const created = await postTimelineEntry(7, { type: 'observation', body: { text: 'disk full' } });
        expect(created.id).toBe(5);
        expect(call().init.method).toBe('POST');
        expect(JSON.parse(call().init.body as string)).toEqual({ type: 'observation', body: { text: 'disk full' } });
    });

    // bare row: unwrapping { entry } here would hand the screen undefined with no error
    it('confirmAiDraft PATCHes .../confirmed and returns the bare entry', async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse(200, entry({ id: 9, author_id: 3 })));
        const confirmed = await confirmAiDraft(7, 9);
        expect(confirmed.author_id).toBe(3);
        expect(call().path).toBe('/incidents/7/timeline/9/confirmed');
        expect(call().init.method).toBe('PATCH');
    });

    it('rejectAiDraft DELETEs .../rejected and returns the bare entry', async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse(200, entry({ id: 9 })));
        const rejected = await rejectAiDraft(7, 9);
        expect(rejected.id).toBe(9);
        expect(call().path).toBe('/incidents/7/timeline/9/rejected');
        expect(call().init.method).toBe('DELETE');
    });

    it('surfaces the confirm race as its own code', async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse(409, { error: 'already_approved', message: 'ai_draft entry was already approved' }));
        await expect(confirmAiDraft(7, 9)).rejects.toMatchObject({ status: 409, code: 'already_approved' });
    });
});

describe('ai draft', () => {
    it('requestAiDraft POSTs context and kind and returns the bare entry', async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse(201, entry({ id: 11 })));
        const draft = await requestAiDraft(7, { context: 'redis refused on 6379', kind: 'log' });
        expect(draft.id).toBe(11);
        expect(call().path).toBe('/incidents/7/ai-draft');
        expect(JSON.parse(call().init.body as string)).toEqual({ context: 'redis refused on 6379', kind: 'log' });
    });

    it('maps a missing provider to upstream_error', async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse(504, { error: 'upstream_error', message: 'Difficulty in responsiveness to the server' }));
        await expect(requestAiDraft(7, { context: 'x' })).rejects.toMatchObject({ status: 504, code: 'upstream_error' });
    });

    it('readAiDraftBody returns the three fields for a well-formed draft', () => {
        expect(readAiDraftBody(entry())).toEqual({ summary: 's', why_it_matters: 'w', likely_fix: 'f' });
    });

    it('readAiDraftBody refuses a non-draft or a malformed body instead of trusting the cast', () => {
        expect(readAiDraftBody(entry({ type: 'observation' }))).toBeNull();
        expect(readAiDraftBody(entry({ body: { summary: 's' } }))).toBeNull();
    });
});

describe('fingerprints', () => {
    it('listFingerprints encodes the project and unwraps { fingerprints }', async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse(200, { fingerprints: [{ id: 1, published_by: 'a@b.com' }] }));
        await expect(listFingerprints('my project')).resolves.toEqual([{ id: 1, published_by: 'a@b.com' }]);
        expect(call().path).toBe('/fingerprints?project=my%20project');
    });

    it('an empty project list is a valid answer, not an error', async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse(200, { fingerprints: [] }));
        await expect(listFingerprints('incidentiq')).resolves.toEqual([]);
    });
});

describe('relevance (fixture)', () => {
    it('makes no network call while fixture-backed', async () => {
        await getRelevance(7, 1);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('returns a line matching the RelevanceLine shape', async () => {
        const line = await getRelevance(7, 1);
        expect(line).not.toBeNull();
        expect(typeof line?.user_id).toBe('number');
        expect(typeof line?.reason).toBe('string');
        expect(line?.reason.length).toBeGreaterThan(0);
        expect(line?.score).toBeGreaterThanOrEqual(0);
        expect(line?.score).toBeLessThanOrEqual(1);
    });

    // the UI must have a sentence for "nobody touched these files"; the fixture has to exercise it
    it('includes the no-relevant-teammate case', async () => {
        await expect(getRelevance(7, 5)).resolves.toBeNull();
    });

    it('is deterministic, so a reload shows the same line', async () => {
        expect(await getRelevance(7, 3)).toEqual(await getRelevance(7, 3));
    });
});
