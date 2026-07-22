import type { Socket, Server } from 'socket.io'
import {pool} from '../db/pool.js'


//function that joins socket(user) into their unique incident room 
export function createRooms(io: Server, socket: Socket) {
    console.log('User joined room')
    socket.on('join-room', async(incidentId) => {
        try {
            //I will Validate incidentId before querying Postgres with zod soon...
            const data = await pool.query(`SELECT id FROM incidents WHERE id = $1`, [incidentId]);

            //Validates if the incident actually exist
            if(data.rows.length === 0) {
                console.log('Incident room does\'t exist')
                socket.emit('no-incidentID', {error: 'Incident room/id does not exist'})
                return
            }

            const incident = data.rows[0]//variable for single incident

            //checks if the incident's org_id is the same as the sockets org_id
            if(incident.org_id !== socket.data.orgId) { //socket.data.orgId will be initalized in socket middlware 
                console.log('Org Id\'s don\'t match')
                socket.emit('Invalid-org', {error: "Org Id's don't match"})
                return
            }

            const roomName = String(data.rows[0].id)
            await socket.join(roomName)
            socket.emit('success', {success: `User joined room ${roomName}`})
        }catch(err) {
            console.log("Unable to join incident room")
            socket.emit('unable-to-join', {error: 'Unable to join incident Room'}) 
        }
    })
}