import type { Socket, Server, DefaultEventsMap } from 'socket.io'
import type { TimelineEntry, TimelineEntryType } from '../../timeline/types.js'
//socket.io response
export interface ClientToServer {
    //types for joining rooms
    'join-room': (incidentId: number) => void
    
    //types for emitting messages
    //every sent message delivers a payload that will make distinghising users easier
    'sending-message': (payload: MessageCLientOrServer) => void //client -> server
}

export interface ServerToClient {
    //types for joining room
    'invalid-type': (value: {error: string}) => void,
    'no-incidentId': (value: {error: string}) => void,
    'Invalid-org': (value: {error: string}) => void,
    'success': (value: {success: string}) => void,
    'User-joined': (value: {message: string}) => void

    //types for emitting messages/failures
    'new-message': (value: TimelineEntry) => void

    //universal error for any type of Socket handler
    'socket-error': (value: {error: string}) => void

    //messaging: error for no socket in a current room
    'no-socket-in-room': (value: {error: string}) => void

    //types for Zod validation
    'Invalid-Schema': (value: {error: string, event?: ClientToServer}) => void
}

//Payload every messsage sends including type and body
export type SendingMessagePayload = TimelineEntry

export interface MessageCLientOrServer {
    id?: number
    incident_id: number,
    author_id?: number
    type: TimelineEntryType,
    body:
        | {
              summary: string;
              why_it_matters: string;
              likely_fix: string;
          }
        | Record<string, unknown>,
    locked?: boolean
}

type UserRole = 'responder' | 'lead' | 'admin';

//data properties within each socket connection
export interface SocketData {
    userId: number,
    orgId: number,
    role: UserRole
}

export type TypeServer = Server<ClientToServer, ServerToClient, DefaultEventsMap, SocketData>
export type TypeSocket = Socket<ClientToServer, ServerToClient, DefaultEventsMap, SocketData>