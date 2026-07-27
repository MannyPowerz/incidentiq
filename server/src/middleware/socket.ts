import jwt from 'jsonwebtoken'
import type {Socket} from 'socket.io'
import type { NextFunction, Request } from 'express'
import type { AccessTokenPayload } from '../auth/types.js'

const variables = process.env.JWT_SECRET

//This socket middleware checks for authentication/authorization from a users access token and will be executed once per connection
//Implmented jwt.verify() to recive payload and initialize it with socket.data.userId and socket.data.orgId
export function SocketMiddlware(req:Request) {
    const io = req.app.get('io')
    io.use((socket: Socket, next: NextFunction) => {
        const token = socket.handshake.auth?.token;
        if(!token) {
            return next(new Error("Token scrutinizing in socketMiddleware does not exist"))
        }
        if(!variables) {
            return next(new Error("Access Token doesn't exist"))
        }
        try {
            const decoded = jwt.verify(token, variables) as AccessTokenPayload;
            socket.data.userId = decoded.sub
            socket.data.orgId = decoded.org_id
            next()
        }
        catch(err) {
            console.log('Socket.io Middleware Error: ', err)
            next(new Error("Socket Middleware did not pass"))
        }

    })
}