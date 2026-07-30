import type { Socket, Server } from 'socket.io';

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
