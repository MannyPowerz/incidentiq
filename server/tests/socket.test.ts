import { pool } from '../src/db/pool';
import { beforeAll, afterAll, describe, expect, it, beforeEach } from 'vitest';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Server, type Socket as serverSocket } from 'socket.io';
import { Socket as clientSocket, io as ioc } from 'socket.io-client';
import { socketHandlerFunction } from '../src/Socket/routes/socketHandlerFunctions.js';
import { formatRoomName } from '../src/Socket/socketHandlers/formatJoin.js';

describe('connection Room', () => {
    let io: Server, serverSocket: serverSocket, clientSocket1: clientSocket;

    let incidentId: number;
    let org1Id: string;
    beforeAll(async () => {
        const {
            rows: [org],
        } = await pool.query(`SELECT id FROM orgs WHERE name = 'Demo Team'`);
        org1Id = org.id;
        return new Promise((resolve: (value: void) => void) => {
            const server = createServer();
            io = new Server(server);
            server.listen(() => {
                const port = (server.address() as AddressInfo).port;
                clientSocket1 = ioc(`http://localhost:${port}`);
                io.on('connection', (socket) => {
                    console.log('server got connection');
                    socket.data.orgId = org1Id;
                    socketHandlerFunction(io, socket);
                });
                clientSocket1.on('connect', () => resolve());
            });
        });
    });

    beforeEach(async () => {
        // Query the seeded organization (Demo Team)
        const {
            rows: [org],
        } = await pool.query(`SELECT id FROM orgs WHERE name = 'Demo Team'`);
        org1Id = org.id;

        // Insert a user for the Demo Team
        const {
            rows: [user],
        } = await pool.query(
            `
      INSERT INTO users (email, password_hash, role, org_id)
      VALUES ($1, $2, $3, $4) 
      RETURNING id
    `,
            ['a@gmail.com', 'hash', 'responder', org1Id]
        );

        // Insert an incident for the Demo Team
        const {
            rows: [incident],
        } = await pool.query(
            `
      INSERT INTO incidents (title, status, org_id, severity, created_by, affected_system)
      VALUES ($1, $2, $3, $4, $5, $6) 
      RETURNING id
    `,
            ['Test Incident', 'detected', org1Id, 'P1', user.id, 'environment']
        );
        incidentId = Number(incident.id);

        // Authenticate the client
        clientSocket1.auth = { orgId: org1Id };
    });

    afterAll(() => {
        io.close();
        clientSocket1.disconnect();
    });

    it('are users they able to join the room ', () => {
        return new Promise(async (resolve: (value: void) => void, reject) => {
            clientSocket1.once('success', () => {
                try {
                    const roomSize = io.of('/').adapter.rooms.get(formatRoomName(incidentId))?.size || 0;
                    expect(roomSize).toBe(1); // Only clientSocket1 should be in the room
                    resolve();
                } catch (err) {
                    reject(err);
                }
            });
            clientSocket1.emit('join-room', incidentId);
        });
    });
});
