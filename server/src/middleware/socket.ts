import type { TypeSocket } from '../InterfaceTypes/socketTypes.js';
import { verifyAccessToken } from '../auth/tokens.js';

// Socket auth middleware — the handshake bouncer. Runs ONCE per connection, before any
// 'connect' handler fires, so socket.data is already trustworthy by the time createRoom runs.
// Reads the access token off the handshake, verifies it, and stamps the identity onto the socket.
export function socketAuth(socket: TypeSocket, next: (err?: Error) => void) {

    const token = socket.handshake.auth?.token; // the client sends it: io(url, { auth: { token }})

    if (!token) return next(new Error('No access token provided'));

    try {
        const payload = verifyAccessToken(token); // reuse our own verifier — throws on bad/expired
        socket.data.userId = Number(payload.sub); // sub is a string in the payload; SocketData.userId is a number
        socket.data.orgId = payload.org_id;
        socket.data.role = payload.role;
        next(); // no argument = admit the connection
    } catch {
        next(new Error('Invalid or expired access token')); // an Error argument = reject the handshake
    }
}
