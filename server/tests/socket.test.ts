import { pool } from '../src/db/pool';
import {signAccessToken} from '../src/auth/tokens.js'
import { beforeAll, afterEach, afterAll, describe, expect, it} from 'vitest';
import { createServer, type Server as HttpServer} from 'node:http';
import type { AddressInfo } from 'node:net';
import { Server, type Socket as serverSocket } from 'socket.io';
import { Socket as ClientSocket, io as ioc } from 'socket.io-client';
import { socketHandlerFunction } from '../src/Socket/routes/socketHandlerFunctions.js';
import { formatRoomName } from '../src/Socket/socketHandlers/formatJoin.js';
import { TypeServer } from '../src/Socket/socketTypes-Schemas/socketTypes.js';
import { socketAuth } from '../src/Socket/middleware/socket.js';
import { TimelineEntry } from '../src/timeline/types.js';

//Full-Stack setup with real server, real Socket authentication, and real postgres.
//Absolute skeleton for one intergration file that is measured in testing room memebership
//and persistant messaging

describe('connection Room', () => {
    let io: TypeServer;
    let httpServer: HttpServer;
    let port: number;
    const clients: ClientSocket[] = []//clients in connection


    //connection setup for server
    beforeAll(() => {
        return new Promise<void>((resolve) => {
            httpServer = createServer();
            io = new Server(httpServer);
            io.use(socketAuth);//handshake gate - runs before connection
            io.on('connection', (socket) => socketHandlerFunction(io, socket))//funnel that keeps all the socket handlers per connection
            httpServer.listen(port, () => {
                port = (httpServer.address() as AddressInfo).port
                resolve()
            })
        })
    })

    //awaiting on disconnect waits before the socket has left after each test before we continue with the next test
    afterEach(async() => {
        await Promise.all(clients.map((c) => new Promise<void>((resolve) => {
            if(!c.connected) return resolve();
            c.once('disconnect', () => resolve())
            c.disconnect()
        })))
        clients.length = 0
    })

    afterAll(() => {
        io.close()
    })
    // error payload; to get a disticnt reject message instead of a timeout error

    //Handles socket.io callback events into something we can await
    function waitFor<T>(client: ClientSocket, event: string): Promise<T> {
        return new Promise((resolve, reject) => {
            //using .once() so event can detach after firing once. Using .on() will fire multiple times and leak across test
            //making sure to include the ack to make sure the receiving side is sending the response
            client.once(event, (payload:T, callback?) => {
                //null for the error since this is the success packet
                callback?.(payload)
                resolve(payload)
            })
            client.once('Invalid-Schema', (err:Error) => {
                client.disconnect();
                reject(err)
            })
        })
    }

    //produces a self-consistent identity including a token to verify user authentication
    async function seedFixture() {
        const { rows: [org] } = await pool.query(`SELECT id FROM orgs WHERE name = 'Demo Team'`)

        const { rows: [user] } = await pool.query('INSERT INTO users (email, password_hash, role, org_id) VALUES($1, $2, $3, $4) RETURNING id, role',
            ['liverpool@gmail.com', '1234', 'lead', org.id]
        )

        const { rows: [incident] } = await pool.query('INSERT INTO incidents (title, status, org_id, severity, created_by) VALUES($1, $2, $3, $4, $5) RETURNING id', 
            ['encrypted', 'detected', org.id, 'P1', user.id]
        )

        //using signAccessToken to verify the token payload of a user - using it statisy the author_id + createRooms orgs check
        const token = signAccessToken({sub: user.id, org_id: org.id, role: user.role})

        return {token, userId: user.id, orgId: org.id, incidentId: Number(incident.id)}
    }

    async function connectAs(token: string) : Promise<ClientSocket> {
        const client = ioc(`http://localhost:${port}`, {
            auth: {token: token},
            reconnection: false //reconnection is false so rejection only responds once
        });
        clients.push(client);
        await waitFor(client, 'connect');
        return client
    }

    //proves that a socket landed in their specific room
    it('joins the incident room', async () => {
        const { token, incidentId } = await seedFixture()
        const client = await connectAs(token)

        const joined = waitFor(client, 'success')
        client.emit('join-room', {incidentId, sinceId: undefined});
        await joined

        const room = io.of('/').adapter.rooms.get(formatRoomName(incidentId));
        expect(room?.size).toBe(1)//this is count because eventhough setup.ts truncates rows after each test, the connection doesn't
    })

    //drives the reall inbound path - Zod middleware, handler, insert, room braodcast
    //and catches the broadcast as a client
    it('persists a message and broadcast it to the room', async () => {
        const { token, userId, incidentId } = await seedFixture();
        const client = await connectAs(token)

        client.emit('join-room', {incidentId, sinceId: undefined});
        await waitFor(client, 'success');
        
        const broadcast = waitFor<TimelineEntry>(client, 'new-message');

        //what the client sends to the server
        client.emit('sending-message', {
            incident_id: incidentId,
            type: 'ai_draft',
            body: {
                summary: 'hello',
                why_it_matters: "idk",
                likely_fix: 'figure it out'
            }
        })
        const entry = await broadcast;
        expect(entry.incident_id).toBe(incidentId);
        expect(entry.type).toBe('ai_draft');
        expect(entry.body.summary).toBe('hello')

        //this assertion proves that both paths produce the same shape, and proves that the collapsing of the two event names still passes that
        //this checks that calling getTime() on entry.created_at doesn't validate a NaN value.
        expect(new Date(entry.created_at).getTime()).not.toBeNaN()

        const { rows } = await pool.query(
            `SELECT author_id, incident_id, type, body FROM timeline_entries WHERE incident_id = $1`,
            [incidentId]
        )
        expect(rows).toHaveLength(1)
    })

    //our 'send-history' proves to send a re-connected socket their incident's timeline from the last one it recieved;
    it('emitting history entries', async () => {
        const { token, userId, incidentId} = await seedFixture();

        //inserting three to entries to amplify testing and durability of assertions
        const { rows } = await pool.query(`INSERT INTO timeline_entries (incident_id, author_id, type, body) VALUES
            ($1, $2, $3, $4), ($5, $6, $7, $8), ($9, $10, $11, $12)`,
            [incidentId, userId, 'observation', {}, incidentId, userId, 'finding', {}, incidentId, userId, 'action', {}]
        )

        const client = await connectAs(token);

        const history = waitFor<TimelineEntry[]>(client, 'send-history')
        client.emit('join-room', {incidentId, sinceId: undefined})

        const entries = await history

        expect(entries.length).toBe(3)
        expect(entries.map(e => e.type)).toEqual(['observation', 'finding', 'action'])
    })

    //verifies the our org gate still holds when using function findIncidentById; enlisting another org to verify the failure when a socket from one org can pull a timeline
    //from another org
    it('verify org gate', async() => {
        const {token} = await seedFixture()

        const { rows: [otherOrg] } = await pool.query(`INSERT INTO orgs (name) VALUES('otherOrg') RETURNING *`)
        const { rows: [secondUser] } = await pool.query('INSERT INTO users (email, password_hash, role, org_id) VALUES($1, $2, $3, $4) RETURNING id, role',
            ['other@gmail.com', '5678', 'lead', otherOrg.id])
        const { rows: [secondIncident] } = await pool.query('INSERT INTO incidents (title, status, org_id, severity, created_by) VALUES($1, $2, $3, $4, $5) RETURNING id', 
            ['bad', 'detected', otherOrg.id, 'P1', secondUser.id])
        const clientA = await connectAs(token)
        try {
            const rejection = waitFor<{error: string}>(clientA, 'socket-error')
            clientA.emit('join-room', {incidentId: secondIncident.id, sinceId: undefined})
    
            const result = await rejection
            expect(result.error).toBeDefined()
        } finally {
            await pool.query(`DELETE FROM incidents WHERE id = $1`, [secondIncident.id])
            await pool.query(`DELETE FROM users WHERE id = $1`, [secondUser.id])
            await pool.query(`DELETE FROM orgs WHERE id = $1`, [otherOrg.id])
            clientA.disconnect()
        }
    })
});