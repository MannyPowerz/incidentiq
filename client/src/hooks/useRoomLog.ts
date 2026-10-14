/**
 * useRoomLog — the room's activity stream: every real thing that happened while the page was open,
 * newest last, capped so a long session cannot grow without bound.
 *
 * Lines come from the socket (useRoomLive), the room (entries, drafts, resolve) and your own actions.
 * The `agent` source is reserved for the local scanner's lines once the agent ships
 * (docs/agent-architecture.md); it is a source here so the panel needs no change when it arrives.
 */

import { useCallback, useRef, useState } from 'react';

export type LogLevel = 'info' | 'ok' | 'warn' | 'error';
export type LogSource = 'socket' | 'room' | 'ai' | 'agent';

export type LogLine = {
    id: number;
    // ISO string, the same as every other timestamp on the wire
    at: string;
    level: LogLevel;
    source: LogSource;
    message: string;
};

export type LogEvent = Omit<LogLine, 'id' | 'at'>;

// enough to scroll back through a long incident; old lines fall off the top
export const MAX_LOG_LINES = 200;

export function useRoomLog(): { lines: LogLine[]; log: (event: LogEvent) => void } {
    const [lines, setLines] = useState<LogLine[]>([]);
    const nextId = useRef(1);

    // stable identity, so passing it to effects and children never re-runs them
    const log = useCallback((event: LogEvent) => {
        const line: LogLine = { ...event, id: nextId.current++, at: new Date().toISOString() };
        setLines((current) => [...current, line].slice(-MAX_LOG_LINES));
    }, []);

    return { lines, log };
}
