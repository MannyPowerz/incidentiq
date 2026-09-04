// types.ts — the TimelineEntry shape (mirrors the timeline_entries table) and the allowed entry types.

// the five entry types the DB CHECK allows — define once, reuse for the type field
export type TimelineEntryType = 'observation' | 'action' | 'finding' | 'system' | 'ai_draft';

//a subset of what a client may post which will be implmented as a z.enum() runtime array
export const ClientPostableTypes = ['observation', 'action', 'finding'] as const satisfies readonly TimelineEntryType[]
export type PostingClientTypes = (typeof ClientPostableTypes)[number]

export interface TimelineEntry {
    id: number; // SQL: BIGSERIAL — the ordering truth (sort by this)

    incident_id: number; // SQL: BIGINT

    author_id: number | null; //author_id no means "Who is accountable for this" instead of "who wrote this"

    type: TimelineEntryType; // SQL: TEXT + CHECK

    body:
        | {
              summary: string;
              why_it_matters: string;
              likely_fix: string;
          }
        | Record<string, unknown>; // SQL: JSONB — ai_draft uses {summary, why_it_matters, likely_fix}; other types use a generic object until their bodies are designed

    locked: boolean; // SQL: BOOLEAN default false

    created_at: Date; // SQL: TIMESTAMPTZ
}

export type TimelineEntryBody = {
    summary: string;
    why_it_matters: string;
    likely_fix: string;
} | Record<string, unknown>