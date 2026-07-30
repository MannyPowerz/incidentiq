import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createServer, type Server as HttpServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Server } from 'socket.io';
import { io as ioc, type Socket as ClientSocket } from 'socket.io-client';
import { socketAuth } from '../src/middleware/socket.js';
import { signAccessToken } from '../src/auth/tokens.js';

// Exercises the REAL socketAuth middleware through a real handshake — unlike socket.test.ts,
// which builds its own server and hand-sets socket.data, bypassing auth entirely. No DB here:
// socketAuth only verifies the JWT and reads its claims, it never queries Postgres.
describe('socket auth middleware', () => {
    let io: Server;
    let httpServer: HttpServer;
    let port: number;
    const clients: ClientSocket[] = [];

    beforeAll(() => {
        return new Promise<void>((resolve) => {
            httpServer = createServer();
            io = new Server(httpServer);
            io.use(socketAuth); // the middleware under test — runs on every handshake, before 'connection'
            httpServer.listen(() => {
                port = (httpServer.address() as AddressInfo).port;
                resolve();
            });
        });
    });

    afterAll(() => {
        clients.forEach((c) => c.disconnect());
        io.close();
    });

    // open a client to the shared server. reconnection:false so a rejected handshake fails once
    // instead of retrying forever and hanging the test.
    function connect(auth?: Record<string, unknown>): ClientSocket {
        const client = ioc(`http://localhost:${port}`, {
            reconnection: false,
            ...(auth ? { auth } : {}),
        });
        clients.push(client);
        return client;
    }

    it('accepts a valid token and stamps identity onto socket.data', () => {
        const token = signAccessToken({ sub: '42', org_id: 7, role: 'responder' });
        return new Promise<void>((resolve, reject) => {
            // reaching 'connection' means the handshake passed, so socketAuth already populated the socket
            io.once('connection', (socket) => {
                try {
                    expect(socket.data.userId).toBe(42); // sub '42' (string) → 42 (number)
                    expect(socket.data.orgId).toBe(7);
                    expect(socket.data.role).toBe('responder');
                    resolve();
                } catch (err) {
                    reject(err);
                }
            });
            const client = connect({ token });
            client.on('connect_error', (err) =>
                reject(new Error(`unexpected connect_error: ${err.message}`))
            );
        });
    });

    it('rejects a connection with no token', () => {
        return new Promise<void>((resolve, reject) => {
            const client = connect(); // no auth payload at all
            client.on('connect', () =>
                reject(new Error('connected without a token — middleware did not block it'))
            );
            client.on('connect_error', (err) => {
                try {
                    expect(err.message).toBe('No access token provided');
                    resolve();
                } catch (e) {
                    reject(e);
                }
            });
        });
    });

    it('rejects a connection carrying a garbage token', () => {
        return new Promise<void>((resolve, reject) => {
            const client = connect({ token: 'not-a-real-jwt' });
            client.on('connect', () => reject(new Error('connected with an invalid token')));
            client.on('connect_error', (err) => {
                try {
                    expect(err.message).toBe('Invalid or expired access token');
                    resolve();
                } catch (e) {
                    reject(e);
                }
            });
        });
    });
});
