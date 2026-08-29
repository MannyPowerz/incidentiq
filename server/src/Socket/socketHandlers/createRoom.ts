import { formatRoomName } from './formatJoin.js'
import { findIncidentById } from '../../incidents/queries.js';
import { findTimelineEntriesSince, findTimelineEntriesByIncident } from '../../timeline/queries.js';
import type { TypeServer, TypeSocket} from '../socketTypes-Schemas/socketTypes.js'
import { TimelineEntry } from '../../timeline/types.js';

//function that joins socket(user) into their unique incident room
/*Client sends sinceId that represents the last seen timelineEntries.id upon disconnection. Somewhere in the client-side, there needs to be a local 
piece of state that tracks the highest id seen so far and will be what the client renders locally*/
export function createRooms(io: TypeServer, socket: TypeSocket) {
    console.log('User joined room');
    socket.on('join-room', async({incidentId, sinceId}) => {
        try {
            //incidents/queires.ts already exports findIncidentByID(id, org_id) which accomplishes both gaurd checks in one WHERE clause
            //timeline.queries.ts header discludes any org filter beacuse route calls findIncidentById first and will acts as the org gate
            const incident = await findIncidentById(incidentId, socket.data.orgId);

            //Validates if the incident actually exist
            if (!incident) {
                console.log("Incident room doesn't exist");
                socket.emit('socket-error', { error: 'Incident room/id does not exist' });
                return;
            }

            const roomName = formatRoomName(incidentId)
            /**joining room before quering history to prevent duplicate entries*/

            await socket.join(roomName)

            /** After a socket joins the room, we determine if the socket is joining a room for the first time based on if Client payload for sinceId is undefined
             *  or if they disconnected in the middle of the room and needs to get all the the missed messages startig from their last seen 
             * timeline_entries id that the client-side rendered/contained locally .
            */
            let history:TimelineEntry[];
            if(sinceId !== undefined) {
                history = await findTimelineEntriesSince(incidentId, sinceId)
            } else {
                history = await findTimelineEntriesByIncident(incidentId)
            }

            /**Providing the send-history event an ack callback will notify server-side the if all goes well and the client recieved the history
             * payload otherwise they will get an error callback specifying the nature of the error simutaneously ensuring timeout prevents the callback
             * from pending indefinitely
             * This ensures send-history will have it's own error-handling control since unsuccessful joining isn't the only potential problem 
             * users could be facing in this file
             *  */ 
            socket.timeout(5000).emit('send-history', history, (err, ackResponse) => {
                if(err) {
                    console.log('Reconnection error and failed to get history', err)
                    socket.emit('socket-error', {error: 'Reconnection error and failed to get history'})
                    return
                }
                console.log('Client recieved histroy', ackResponse)
            })
            
            //broadcasting message to everyone in room of user joining
            io.to(formatRoomName(incidentId)).emit('User-joined', {message: `A user joined room ${roomName}`})
            socket.emit('success', {success: `Joined room ${roomName}`})
        }catch(err) {
            console.log("Unable to join incident room. Error: ", err)
            socket.emit('socket-error', {error: 'Unable to join incident Room'})
            //socket leaves for thrown exceptions that might've occured in the try block preventing users to be in a broken state
            await socket.leave(formatRoomName(incidentId)) 
        }
    });
}