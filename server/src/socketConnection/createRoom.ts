import type { Socket, Server } from 'socket.io'
import {pool} from '../db/pool.js'


//function that joins socket(user) into their unique incident room 
export function createRooms(io: Server, socket: Socket) {
    console.log('User joined room')
    socket.on('join-room', async(incidentId) => {
        try {
            const data = await pool.query(`SELECT id FROM incidents WHERE id = $1`, [incidentId]);
            if(data.rows.length === 0) {
                console.log('Incident room does\'t exist')
                socket.emit('no-incidentID', {error: 'Incident room/id does not exist'})
                return
            }
            const roomName = data.rows[0].id
            socket.join(incidentId)
            socket.emit('success', {success: `User joined room ${roomName}`})
        }catch(err) {
            console.log("Unable to join incident room")
            socket.emit('unable-to-join', {error: 'Unable to join incident Room'}) 
        }
    })
}