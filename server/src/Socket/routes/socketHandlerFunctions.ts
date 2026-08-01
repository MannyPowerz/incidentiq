import type { TypeServer, TypeSocket } from '../socketTypes-Schemas/socketTypes.js'
import { createRooms } from '../socketHandlers/createRoom.js'
import { emitAndPersist } from '../socketHandlers/emittingMessages.js'
import { validateSocketData } from '../middleware/socket.js'
import { socketErrorSink } from '../middleware/socket.js'

//installs the open gate for one connection, which is called later in index.ts per connect
export function socketHandlerFunction(io:TypeServer, socket:TypeSocket) {
    socket.use(validateSocketData(socket))
    socketErrorSink(socket)

    createRooms(io, socket)
    emitAndPersist(io, socket)
}
