import { pool } from '../db/pool.js';
import type { Incidents } from '../auth/types.js';
import type { TypeServer, TypeSocket } from '../InterfaceTypes/socket.js';

//function that joins socket(user) into their unique incident room
export function createRooms(io: TypeServer, socket: TypeSocket) {
    console.log('User joined room');
    socket.on('join-room', async (incidentId: number) => {
        try {
            if (typeof incidentId !== 'number') {
                console.log('Invalid type for incidentId');
                socket.emit('invalid-type', { error: 'Invalid type for incidentId' });
                return;
            }
            //I will Validate incidentId before querying Postgres with zod soon...
            const data = await pool.query(`SELECT id, org_id FROM incidents WHERE id = $1`, [
                incidentId,
            ]);

            //Validates if the incident actually exist
            if (data.rows.length === 0) {
                console.log("Incident room doesn't exist");
                socket.emit('no-incidentId', { error: 'Incident room/id does not exist' });
                return;
            }

            const incident: Incidents = data.rows[0]; //variable for single incident

            //checks if the incident's org_id is the same as the sockets org_id
            if (incident.org_id !== socket.data.orgId) {
                //socket.data.orgId will be initalized in socket middlware
                console.log("Org Id's don't match");
                socket.emit('Invalid-org', { error: "Org Id's don't match" });
                return;
            }

            const roomName = String(data.rows[0].id);
            console.log(roomName);
            await socket.join(roomName);

            //broadcasting message to everyone in room of user joining
            io.to(roomName).emit('User-joined', { message: `A user joined room ${roomName}` });
            socket.emit('success', { success: `User joined room ${roomName}` });
        } catch (err) {
            console.log('Unable to join incident room. Error: ', err);
            socket.emit('unable-to-join', { error: 'Unable to join incident Room' });
        }
    });
}
