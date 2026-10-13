/**
 * useRelevance — the "who should look at this" line for each timeline entry, keyed by entry id.
 *
 * Fetches only ids it has not asked about yet, so an entry arriving over the socket gets its line
 * without refetching the rest. An entry whose lookup failed simply has no line: relevance is a
 * hint, and a missing hint is better than an error banner under every entry.
 *
 * getRelevance is fixture-backed today (api/fixtures/relevance.ts). When the server returns
 * relevance with the timeline, this hook is the one place that changes.
 */

import { useEffect, useRef, useState } from 'react';
import { getRelevance } from '../api';
import type { RelevanceLine } from '../api';

// null value = asked, and nobody on the team has touched these files; an absent key = not known yet
export type RelevanceById = ReadonlyMap<number, RelevanceLine | null>;

export function useRelevance(incidentId: number | null, entryIds: readonly number[]): RelevanceById {
    const [byId, setById] = useState<RelevanceById>(() => new Map());
    // ids already requested for the current room, so re-renders never ask twice
    const requested = useRef(new Set<number>());
    const roomRef = useRef<number | null>(null);
    // a string, not the array: the page builds a new array every render, and that alone must not re-run this
    const key = entryIds.join(',');

    useEffect(() => {
        if (incidentId === null) return;
        // a different room starts over; results still in flight for the old room are dropped below
        if (roomRef.current !== incidentId) {
            roomRef.current = incidentId;
            requested.current = new Set();
            setById(new Map());
        }
        for (const id of key ? key.split(',').map(Number) : []) {
            if (requested.current.has(id)) continue;
            requested.current.add(id);
            getRelevance(incidentId, id).then(
                // checked against the room, not a per-run flag: a new entry re-running this effect
                // must not discard lookups for the entries before it
                (line) => {
                    if (roomRef.current === incidentId) setById((prev) => new Map(prev).set(id, line));
                },
                // forget the attempt so a later render can retry it
                () => requested.current.delete(id),
            );
        }
    }, [incidentId, key]);

    return byId;
}
