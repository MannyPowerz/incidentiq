import { pool } from "../../db/pool.js";
import { formatRoomName } from "./formatJoin.js";
import type { TypeServer, TypeSocket, MessageCLientOrServer} from "../socketTypes-Schemas/socketTypes.js";


//Once joining a specific incident, users can send messages including a payload of incident_id, author_id, type, and body
//Based off the Clients payloaded response to the server, we will save that into timeline_entries and know who is responding
//and broadcast it to everyone in the room
export function emitAndPersist(io:TypeServer, socket: TypeSocket) {
    socket.on('sending-message', async({incident_id, type, body}) => {
        try{
            const {rows: [entry]} = await pool.query<MessageCLientOrServer>(`INSERT INTO timeline_entries(incident_id, author_id, type, body) VALUES($1, $2, $3, $4) RETURNING *`,
                //using socket.data.userId prevents trusting whatever the client sends and authenticating themselves
                [incident_id, socket.data.userId, type, body])
            io.to(formatRoomName(incident_id)).emit('new-message', {
                id: entry.id,//so client can reference the id later for other context's
                incident_id: entry.incident_id,
                author_id: entry.author_id,
                type: entry.type,
                body: entry.body,
                locked: entry.locked
            })
        }catch(err) {
            console.log('Error in sending and persisting messages: ', err);
            socket.emit('message-error', {error: 'Error in sending and persisting messages'})
        } 
    })
}