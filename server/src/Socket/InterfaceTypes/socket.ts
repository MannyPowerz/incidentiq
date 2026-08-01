import type { Socket, Server } from 'socket.io';
import type { TimelineEntry } from '../../timeline/types.js';

//socket.io response
export interface ClientToServerJoining {
    'join-room': (incidentId: number) => void;
}

export interface ServerToClientJoining {
    'invalid-type': (value: { error: string }) => void;
    'no-incidentId': (value: { error: string }) => void;
    'Invalid-org': (value: { error: string }) => void;
    success: (value: { success: string }) => void;
    'unable-to-join': (value: { error: string }) => void;
    'User-joined': (value: { message: string }) => void;
    // entry:new — broadcast to an incident room after a timeline write lands in the DB.
    // Adding it here is what makes io.to(room).emit('entry:new', entry) type-checked: TypeServer
    // is Server<..., ServerToClientJoining, ...>, so tsc checks both the event name and the
    // payload shape against this map. Wrong event name or wrong entry shape = compile error,
    // not a silent runtime typo.
    'entry:new': (entry: TimelineEntry) => void;
}

type UserRole = 'responder' | 'lead' | 'admin';

//data properties within each socket connection
export interface SocketData {
    userId: number;
    orgId: number;
    role: UserRole;
}

export type TypeServer = Server<ClientToServerJoining, ServerToClientJoining, any, SocketData>;
export type TypeSocket = Socket<ClientToServerJoining, ServerToClientJoining, any, SocketData>;
