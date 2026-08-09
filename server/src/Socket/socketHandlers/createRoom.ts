import { formatRoomName } from './formatJoin.js'
import { findIncidentById } from '../../incidents/queries.js';
import type { Incidents } from '../../auth/types.js';
import type { TypeServer, TypeSocket} from '../socketTypes-Schemas/socketTypes.js'

//function that joins socket(user) into their unique incident room
export function createRooms(io: TypeServer, socket: TypeSocket) {
    console.log('User joined room');
    socket.on('join-room', async (incidentId: number) => {
        try {
            //incidents/queires.ts already exports findIncidentByID(id, org_id) which accomplishes both gaurd checks in one WHERE clause
            //timeline.queries.ts header discludes any org filter beacuse route calls findIncidentById first and will acts as the org gate
            const incident = await findIncidentById(incidentId, socket.data.orgId);

            //Validates if the incident actually exist
            if (!incident) {
                console.log("Incident room doesn't exist");
                socket.emit('no-incidentId', { error: 'Incident room/id does not exist' });
                return;
            }

            const roomName = formatRoomName(incidentId)
            await socket.join(roomName)

            //broadcasting message to everyone in room of user joining
            io.to(formatRoomName(incidentId)).emit('User-joined', {message: `A user joined room ${roomName}`})
            socket.emit('success', {success: `User joined room ${roomName}`})
        }catch(err) {
            console.log("Unable to join incident room. Error: ", err)
            socket.emit('socket-error', {error: 'Unable to join incident Room'}) 
        }
    });
}
