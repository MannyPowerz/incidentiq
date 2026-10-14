// the only import path screens use for data: import { listIncidents } from '../api'
// publishFingerprint is intentionally absent — it is the agent's call (see fingerprints.ts).
export { ApiError, NETWORK_ERROR } from './client';
export { createIncident, getIncident, listIncidents, resolveIncident } from './incidents';
export type { CreateIncidentInput } from './incidents';
export { confirmAiDraft, listTimeline, postTimelineEntry, rejectAiDraft } from './timeline';
export type { PostTimelineEntryInput } from './timeline';
export { readAiDraftBody, requestAiDraft } from './aiDraft';
export type { AiDraftInput } from './aiDraft';
export { listFingerprints } from './fingerprints';
export { getRelevance } from './relevance';
export type { RelevanceLine } from './relevance';
export {
    connectSocket,
    disconnectSocket,
    joinRoom,
    mergeEntries,
    onConfirm,
    onEntry,
    onHistory,
    onReject,
    onSocketError,
} from './socket';
export type { RoomSocket } from './socket';
export * from './types';
