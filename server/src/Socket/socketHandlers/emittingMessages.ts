import { pool } from "../../db/pool.js";
import { formatRoomName } from "./formatJoin.js";
import type { TypeServer, TypeSocket} from "../socketTypes-Schemas/socketTypes.js";
import { TimelineEntry } from "../../timeline/types.js";
import { insertTimelineEntry } from "../../timeline/queries.js";

//Once joining a specific incident, users can send messages including a payload of incident_id, author_id, type, and body
//Based off the Clients payloaded response to the server, we will save that into timeline_entries and know who is responding
//and broadcast it to everyone in the room
export function emitAndPersist(io:TypeServer, socket: TypeSocket) {
    socket.on('sending-message', async({incident_id, type, body}) => {
        try{
            //an additional incident check; since users will be able to archive the incident once disconnection
            //ensuring validility at JOINING TIME rather than just joining
            if(!incident_id) {
                console.log('Cannot send message: Incident id does not exist')
                socket.emit('no-incidentId', {error: 'Cannot send message: Incident id does not exist'})
                return
            }

            //extracting org_id from incidents to still check and see stillness and credibility if the org_id
            const { rows: [incidents]} = await pool.query(`SELECT org_id FROM incidents WHERE id = $1`, [incident_id])

            //first check on orgId on this specific path; since we are creating independent socket events, nothing forces
            //users to travel through events in a distinct linear direction either of calling one before the other.
            if(incidents.org_id !== socket.data.orgId) {
                console.log('OrgId is invalid to send message')
                socket.emit('Invalid-org', {error: 'OrgId is invalid to send message'})
                return
            }

            //checks if socket is in the current incident room
            if(!socket.rooms.has(formatRoomName(incident_id))) {
                console.log('Socket  does not exist in the room')
                socket.emit('no-socket-in-room', {error: 'Socket  does not exist in the room'})
                return
            }

            //Decided to use query function insertTimelineEntry since they are the exact same INSERT with the same RETURNING*
            //Using a raw pg query will create two INSERTS into one table one of which will serailizes explicitly and the other 
            //leaning on pg's implicit object-handling
            //using socket.data.userId prevents trusting whatever the client sends and authenticating themselves
            const entry:TimelineEntry = await insertTimelineEntry(incident_id, socket.data.orgId, type, body)

            io.to(formatRoomName(incident_id)).emit('new-message', entry)
        }catch(err) {
            console.log('Error in sending and persisting messages: ', err);
            socket.emit('socket-error', {error: 'Error in sending and persisting messages'})
        } 
    })
}