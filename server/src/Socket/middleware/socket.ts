import {z} from 'zod'
import { verifyAccessToken } from '../../auth/tokens.js';
import { socketSchemas } from '../socketTypes-Schemas/socketSchemas.js';
import type { Event } from 'socket.io';
import type { ClientToServer, TypeSocket } from '../socketTypes-Schemas/socketTypes.js';

// Socket auth middleware — the handshake bouncer. Runs ONCE per connection, before any
// 'connect' handler fires, so socket.data is already trustworthy by the time createRoom runs.
// Reads the access token off the handshake, verifies it, and stamps the identity onto the socket.
export function socketAuth(socket: TypeSocket, next: (err?: Error) => void){

    //"?" gaurd is appropriate since client has fuull jurisdiction of sending
    const token = socket.handshake.auth?.token; // the client sends it: io(url, { auth: { token }})

    if (!token) return next(new Error('No access token provided'));

    try {
        const payload = verifyAccessToken(token); // reuse our own verifier — throws on bad/expired
        socket.data.userId = Number(payload.sub); // sub is a string in the payload; SocketData.userId is a number
        socket.data.orgId = payload.org_id;
        socket.data.role = payload.role;
        next(); // no argument = admit the connection
    } catch(err) {
        console.log(err)
        next(new Error('Invalid or expired access token')); // an Error argument = reject the handshake
    }
}

//validates the payload that is being returned for each ClientToServer response
export function validateSocketData(socket: TypeSocket) {
    return(packet: Event, next: (err?: Error) => void) => {
        const [eventName, ...args] = packet;
        const payload = args[0]//the arg to be validated
        const schema = socketSchemas[eventName as keyof ClientToServer] 

        //this guard treats schema as the lie it is, as indexing with an arbitrary string is undefined
        if(!schema) {
            return next(new Error('unauthorized event'))
        }
        const result = schema.safeParse(payload)
        
        if(!result.success) {
            console.log(z.prettifyError(result.error))//contians the field path and reasoning in a human readable way
            return next(new Error('payload does not match schema rules'))
        }
        next()
    }
}
/**A Middleware rejections route */
//this function makes errors visible to the client. Without it, a bad payload is a silent failure on the client's side
//without any adherenace of the event that triggered it
export function socketErrorSink(socket: TypeSocket) {
    socket.on('error', (err) => {
        console.log('Signs of hostile client detected', err)
        socket.emit('Invalid-Schema', {error: 'Zod rejection: invalid schema rules for specific event'})
        //disposes the sockets connection and underlying connection
        socket.disconnect(true)
    })
}