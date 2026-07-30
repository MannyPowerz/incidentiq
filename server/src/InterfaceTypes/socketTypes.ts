import type { Socket, Server, DefaultEventsMap } from 'socket.io'
import type { TimeLineBody, TimelineEntries } from '../auth/types.js'

//socket.io response
export interface ClientToServer {
    //types for joining rooms
    'join-room': (incidentId: number) => void
    
    //types for emitting messages
    //every sent message delivers a payload that will make distinghising users easier
    'sending-message': (payload: SendingMessagePayload) => void //client -> server
}

export interface ServerToClient {
    //types for joining room
    'invalid-type': (value: {error: string}) => void,
    'no-incidentId': (value: {error: string}) => void,
    'Invalid-org': (value: {error: string}) => void,
    'success': (value: {success: string}) => void,
    'unable-to-join': (value:{error: string}) => void,
    'User-joined': (value: {message: string}) => void

    //types for emitting messages/failures
    'new-message': (value: TimelineEntries) => void
    'message-error': (value: {error: string}) => void
}

//Payload every messsage sends including type and body
type SendingMessagePayload = {incidentId: number, authorId: number} & TimeLineBody

type UserRole = 'responder' | 'lead' | 'admin';

//data properties within each socket connection
export interface SocketData {
    userId: number,
    orgId: number,
    role: UserRole
}

export type TypeServer = Server<ClientToServer, ServerToClient, DefaultEventsMap, SocketData>
export type TypeSocket = Socket<ClientToServer, ServerToClient, DefaultEventsMap, SocketData>