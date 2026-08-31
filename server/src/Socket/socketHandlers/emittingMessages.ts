import { formatRoomName } from "./formatJoin.js";
import type { TypeServer, TypeSocket} from "../socketTypes-Schemas/socketTypes.js";
import { TimelineEntry } from "../../timeline/types.js";
import { insertTimelineEntry } from "../../timeline/queries.js";
import { findIncidentById } from "../../incidents/queries.js";

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
                socket.emit('socket-error', {error: 'Cannot send message: Incident id does not exist'})
                return
            }

            //Org-gate to still check the stillness and credibility if the org_id
            const incident = await findIncidentById(incident_id, socket.data.orgId);

            //Validates if the incident actually exist
            if (!incident) {
                console.log("Incident room doesn't exist");
                socket.emit('socket-error', { error: 'Incident room/id does not exist' });
                return;
            }

            //checks if socket is in the current incident room
            if(!socket.rooms.has(formatRoomName(incident.id))) {
                console.log('Socket  does not exist in the room')
                socket.emit('no-socket-in-room', {error: 'Socket  does not exist in the room'})
                return
            }

            //Decided to use query function insertTimelineEntry since they are the exact same INSERT with the same RETURNING*
            //Using a raw pg query will create two INSERTS into one table one of which will serailizes explicitly and the other 
            //leaning on pg's implicit object-handling
            //using socket.data.userId prevents trusting whatever the client sends and authenticating themselves
            const entry:TimelineEntry = await insertTimelineEntry(incident_id, socket.data.userId, type, body)

            io.to(formatRoomName(incident_id)).emit('new-message', entry)
        }catch(err) {
            console.log('Error in sending and persisting messages: ', err);
            socket.emit('socket-error', {error: 'Error in sending and persisting messages'})
        } 
    })
}