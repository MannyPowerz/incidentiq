import type { Socket, Server, DefaultEventsMap } from 'socket.io'
import type { TimelineEntry} from '../../timeline/types.js'
import type { ValidatingMessage, ValidatingJoining } from './socketSchemas.js'
//socket.io response
export interface ClientToServer {
    //types for joining rooms
    'join-room': (payload: ValidatingJoining) => void
    
    //types for emitting messages
    //every sent message delivers a payload that will make distinghising users easier
    'sending-message': (payload: ValidatingMessage) => void //client -> server
}

export interface ServerToClient {
    //types for joining room
    'success': (value: {success: string}) => void,
    'send-history': (value: TimelineEntry[], response: (error: Error, ackResponse: string) => void) => void
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


type UserRole = 'responder' | 'lead' | 'admin';

//data properties within each socket connection
export interface SocketData {
    userId: number,
    orgId: number,
    role: UserRole
}

export type TypeServer = Server<ClientToServer, ServerToClient, DefaultEventsMap, SocketData>
export type TypeSocket = Socket<ClientToServer, ServerToClient, DefaultEventsMap, SocketData>