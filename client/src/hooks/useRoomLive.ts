/**
 * useRoomLive — the live half of a room page: one socket per open room, merged into the same
 * entries the page loaded over HTTP.
 *
 * Receive-only. Posting stays on HTTP, whose route writes to Postgres and then broadcasts
 * new-message (timeline/routes/create.ts), so the socket never needs to write (ADR 0018, proposed).
 *
 * The page owns the entries; this hook only hands it updates. Every update goes through mergeEntries
 * (dedupe + sort by id, ADR 0001), so an entry seen twice, once from the POST response and once as
 * the broadcast echo, renders once and in id order.
 */

import { useEffect, useRef, useState } from 'react';
import { connectSocket, disconnectSocket, joinRoom, mergeEntries, onConfirm, onEntry, onHistory, onReject, onSocketError } from '../api';
import type { TimelineEntry } from '../api';
import type { LiveState } from '../components/ui';
import { refresh } from '../auth/api';
import type { LogEvent } from './useRoomLog';

export type EntriesUpdate = (entries: TimelineEntry[]) => TimelineEntry[];

type UseRoomLiveOptions = {
    // null while the page has no room to join (loading, not found)
    incidentId: number | null;
    // the highest entry id the page holds; read on every (re)join so the server sends only the gap
    lastSeenId: number;
    // the signed-in user, so their own posts echoing back are not announced to them
    currentUserId: number | null;
    apply: (update: EntriesUpdate) => void;
    // where connection and room events are reported for the activity log; optional
    onEvent?: (event: LogEvent) => void;
};

export type RoomLive = {
    state: LiveState;
    // the latest arrival worth announcing, for one polite live region on the page
    announcement: string;
};

const TYPE_WORD: Record<TimelineEntry['type'], string> = {
    observation: 'observation',
    action: 'action',
    finding: 'finding',
    system: 'system note',
    ai_draft: 'AI draft',
};

export function useRoomLive({ incidentId, lastSeenId, currentUserId, apply, onEvent }: UseRoomLiveOptions): RoomLive {
    const [state, setState] = useState<LiveState>('idle');
    const [announcement, setAnnouncement] = useState('');

    // refs, not effect deps: these change on every entry, and reconnecting on each would drop the socket
    const lastSeenRef = useRef(lastSeenId);
    const userRef = useRef(currentUserId);
    const applyRef = useRef(apply);
    const eventRef = useRef(onEvent);
    lastSeenRef.current = lastSeenId;
    userRef.current = currentUserId;
    applyRef.current = apply;
    eventRef.current = onEvent;

    useEffect(() => {
        if (incidentId === null) return;
        const socket = connectSocket();
        setState('syncing');
        const report = (event: LogEvent) => eventRef.current?.(event);
        // the first connect joins; every later one is a reconnect that rejoins from the last id held
        let connectedBefore = false;
        report({ source: 'socket', level: 'info', message: `Connecting to room #${incidentId}` });

        // who an entry belongs to, in the words the log uses
        const who = (entry: TimelineEntry) =>
            entry.author_id === userRef.current ? 'you' : entry.author_id === null ? (entry.type === 'system' ? 'the system' : 'the AI') : `User #${entry.author_id}`;
        // one refresh per failed handshake: an expired token gets one retry, a revoked session does not loop
        let refreshedSinceConnect = false;

        const merge = (incoming: TimelineEntry[]) => applyRef.current((entries) => mergeEntries(entries, incoming));

        // 'connect' fires on the first connection and on every automatic reconnect, so the gap fill is one code path
        const handleConnect = () => {
            refreshedSinceConnect = false;
            report({
                source: 'socket',
                level: 'info',
                message: connectedBefore ? `Reconnected, rejoining after entry #${lastSeenRef.current}` : 'Connected, joining the room',
            });
            connectedBefore = true;
            joinRoom(socket, incidentId, lastSeenRef.current);
        };

        const handleDisconnect = () => {
            setState('syncing');
            report({ source: 'socket', level: 'warn', message: 'Connection lost, retrying' });
        };

        const handleConnectError = async () => {
            // socket.active is true while socket.io is still retrying a dropped transport by itself.
            // False means the server's auth middleware refused the handshake, which it never retries.
            if (socket.active) {
                setState('syncing');
                report({ source: 'socket', level: 'warn', message: 'Server unreachable, retrying' });
                return;
            }
            if (refreshedSinceConnect) {
                setState('failing');
                report({ source: 'socket', level: 'error', message: 'Rejoin refused again. Sign in to reconnect' });
                return;
            }
            refreshedSinceConnect = true;
            report({ source: 'socket', level: 'warn', message: 'Session expired, refreshing it' });
            // the 15-minute access token can expire while the tab sits idle; the auth callback reads the new one
            const token = await refresh();
            if (token) socket.connect();
            else {
                setState('failing');
                report({ source: 'socket', level: 'error', message: 'Session could not be refreshed. Sign in to reconnect' });
            }
        };

        socket.on('connect', handleConnect);
        socket.on('disconnect', handleDisconnect);
        socket.on('connect_error', handleConnectError);

        const unsubscribe = [
            // history is the last step of a join, so it is also the signal that the room is live
            onHistory(socket, (entries) => {
                merge(entries);
                setState('live');
                report({
                    source: 'socket',
                    level: 'ok',
                    message:
                        entries.length === 0
                            ? 'Live. Timeline is up to date'
                            : `Live. ${entries.length} ${entries.length === 1 ? 'entry' : 'entries'} caught up from the server`,
                });
            }),
            onEntry(socket, (entry) => {
                // at or below the last id held means the page already has it, usually from its own POST response
                const isNew = entry.id > lastSeenRef.current;
                merge([entry]);
                if (isNew && entry.author_id !== userRef.current) {
                    setAnnouncement(`New ${TYPE_WORD[entry.type]} in the timeline`);
                    report({ source: 'room', level: 'info', message: `New ${TYPE_WORD[entry.type]} #${entry.id} from ${who(entry)}` });
                }
            }),
            // a confirm keeps the id and changes author_id, so the merge replaces it in place
            onConfirm(socket, (entry) => {
                merge([entry]);
                report({ source: 'room', level: 'ok', message: `AI draft #${entry.id} confirmed by ${who(entry)}` });
            }),
            onReject(socket, (entry) => {
                applyRef.current((entries) => entries.filter((e) => e.id !== entry.id));
                report({ source: 'room', level: 'info', message: `AI draft #${entry.id} rejected and deleted` });
            }),
            onSocketError(socket, (error) => {
                setState('failing');
                report({ source: 'socket', level: 'error', message: `Server error: ${error}` });
            }),
        ];

        return () => {
            unsubscribe.forEach((off) => off());
            socket.off('connect', handleConnect);
            socket.off('disconnect', handleDisconnect);
            socket.off('connect_error', handleConnectError);
            disconnectSocket(socket);
        };
    }, [incidentId]);

    return { state, announcement };
}
