import type { Socket, Server } from 'socket.io'
import { createRooms } from '../socketConnection/createRoom.js'

export function socketHandlerFunction(io:Server, socket:Socket) {
    createRooms(io, socket)
}