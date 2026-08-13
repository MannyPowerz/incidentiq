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
    'new-message': (value: MessageCLientOrServer) => void

    //universal error for any type of Socket handler
    'socket-error': (value: {error: string}) => void

    'no-socket-in-room': (value: {error: string}) => void

    //types for Zod validation
    'Invalid-Schema': (value: {error: string, event?: ClientToServer}) => void

    // entry:new — broadcast to an incident room after a timeline write lands in the DB.
    // Adding it here is what makes io.to(room).emit('entry:new', entry) type-checked: TypeServer
    // is Server<..., ServerToClientJoining, ...>, so tsc checks both the event name and the
    // payload shape against this map. Wrong event name or wrong entry shape = compile error,
    // not a silent runtime typo.
    'entry:new': (entry: TimelineEntry) => void;
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