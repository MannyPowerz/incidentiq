import type { Socket, Server } from 'socket.io'
import { createRooms } from '../socketConnection/createRoom.js'
import { emitAndPersist } from '../socketConnection/emittingMessages.js'
import { socketAuth } from '../middleware/socket.js'

export function socketHandlerFunction(io:Server, socket:Socket) {
    createRooms(io, socket)
    emitAndPersist(io, socket)
}