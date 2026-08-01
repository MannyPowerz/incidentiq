import { pool } from "../db/pool.js";
import { formatRoomName } from "./formatJoin.js";
import type { TypeServer, TypeSocket} from "../socketTypes-Schemas/socketTypes.js";
import type { TimelineEntries } from "../auth/types.js";

//Once joining a specific incident, users can send messages including a payload of incident_id, author_id, type, and body
//Based off the Clients payloaded response to the server, we will save that into timeline_entries and know who is responding
//and broadcast it to everyone in the room
export function emitAndPersist(io:TypeServer, socket: TypeSocket) {
    socket.on('sending-message', async({incidentId, type, body}) => {
        try{
            const {rows: [entry]} = await pool.query<TimelineEntries>(`INSERT INTO timeline_entries(incident_id, author_id, type, body) VALUES($1, $2, $3, $4) RETURNING *`,
                //using socket.data.userId prevents trusting whatever the client sends and authenticating themselves
                [incidentId, socket.data.userId, type, body])
            io.to(formatRoomName(incidentId)).emit('new-message', entry)
        }catch(err) {
            console.log('Error in sending and persisting messages: ', err);
            socket.emit('message-error', {error: 'Error in sending and persisting messages'})
        } 
    })
}