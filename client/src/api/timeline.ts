// timeline.ts — all real. server/src/timeline/routes/*

import { jsonInit, request } from './client';
import type { ClientPostableType, TimelineEntry } from './types';

// oldest-first by id (the server orders by id ASC). `since` returns only entries with id > since,
// which is the HTTP route to the same gap-fill the socket's send-history does on join.
export async function listTimeline(incidentId: number, since?: number): Promise<TimelineEntry[]> {
    const query = since === undefined ? '' : `?since=${since}`;
    const { entries } = await request<{ entries: TimelineEntry[] }>(`/incidents/${incidentId}/timeline${query}`);
    return entries;
}

export type PostTimelineEntryInput = {
    type: ClientPostableType;
    body: Record<string, unknown>;
};

export async function postTimelineEntry(incidentId: number, input: PostTimelineEntryInput): Promise<TimelineEntry> {
    const { entry } = await request<{ entry: TimelineEntry }>(`/incidents/${incidentId}/timeline`, jsonInit('POST', input));
    return entry;
}

// bare entry, not { entry } — confirm.ts and reject.ts respond with the row itself
export function confirmAiDraft(incidentId: number, entryId: number): Promise<TimelineEntry> {
    return request<TimelineEntry>(`/incidents/${incidentId}/timeline/${entryId}/confirmed`, { method: 'PATCH' });
}

export function rejectAiDraft(incidentId: number, entryId: number): Promise<TimelineEntry> {
    return request<TimelineEntry>(`/incidents/${incidentId}/timeline/${entryId}/rejected`, { method: 'DELETE' });
}
