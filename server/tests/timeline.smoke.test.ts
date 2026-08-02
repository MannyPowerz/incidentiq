import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import type { AddressInfo } from 'node:net';
import { io as ioc, type Socket as ClientSocket } from 'socket.io-client';
import { pool } from '../src/db/pool.js';
import { app, server, io } from '../src/socketServer.js';
import { authRouter } from '../src/auth/routes/index.js';
import { incidentRouter } from '../src/incidents/routes/index.js';
import { timelineRouter } from '../src/timeline/routes/index.js';
import { socketAuth } from '../src/Socket/middleware/socket.js';
import { socketHandlerFunction } from '../src/Socket/routes/socketHandlerFunctions.js';

// Wire the shared app/io exactly like index.ts (minus the DB fail-fast and listen-on-PORT), then
// listen on a random port so a real socket client can join rooms and observe the live broadcast.
// The HTTP routes are driven in-process with supertest; the socket path uses the same singleton io.
let port: number;
const clients: ClientSocket[] = [];

beforeAll(async () => {
    app.use(express.json());
    app.use(cookieParser());
    app.use('/auth', authRouter);
    app.use('/incidents', incidentRouter);
    app.use('/incidents/:id/timeline', timelineRouter);
    io.use(socketAuth);
    io.on('connect', (socket) => socketHandlerFunction(io, socket));
    await new Promise<void>((resolve) => server.listen(0, resolve));
    port = (server.address() as AddressInfo).port;
});

afterAll(() => {
    clients.forEach((c) => c.disconnect());
    io.close(); // also closes the underlying http server
});

// register a fresh user + open an incident, return the token and the new incident's id
async function setup() {
    const creds = { email: 'timeline@example.com', password: 'password123' };
    const reg = await request(app).post('/auth/register').send(creds);
    const token = reg.body.accessToken as string;
    const created = await request(app)
        .post('/incidents')
        .set({ Authorization: `Bearer ${token}` })
        .send({ title: 'DB down', severity: 'P1' });
    return { token, auth: { Authorization: `Bearer ${token}` }, incidentId: created.body.incident.id };
}

describe('timeline smoke test', () => {
    it('posts an entry, then lists it back (oldest-first)', async () => {
        const { auth, incidentId } = await setup();

        const posted = await request(app)
            .post(`/incidents/${incidentId}/timeline`)
            .set(auth)
            .send({ type: 'observation', body: { text: 'first' } });
        expect(posted.status).toBe(201);
        expect(posted.body.entry.type).toBe('observation');
        expect(posted.body.entry.incident_id).toBe(incidentId);

        await request(app)
            .post(`/incidents/${incidentId}/timeline`)
            .set(auth)
            .send({ type: 'action', body: { text: 'second' } });

        const list = await request(app).get(`/incidents/${incidentId}/timeline`).set(auth);
        expect(list.status).toBe(200);
        expect(list.body.entries).toHaveLength(2);
        // oldest-first: the ids ascend
        expect(list.body.entries[0].id).toBeLessThan(list.body.entries[1].id);
    });

    it('?since gap-fill returns only entries newer than the given id', async () => {
        const { auth, incidentId } = await setup();

        const first = await request(app)
            .post(`/incidents/${incidentId}/timeline`)
            .set(auth)
            .send({ type: 'observation', body: { text: 'a' } });
        const firstId = first.body.entry.id;

        const second = await request(app)
            .post(`/incidents/${incidentId}/timeline`)
            .set(auth)
            .send({ type: 'finding', body: { text: 'b' } });

        const gap = await request(app)
            .get(`/incidents/${incidentId}/timeline?since=${firstId}`)
            .set(auth);
        expect(gap.status).toBe(200);
        expect(gap.body.entries).toHaveLength(1); // only the second one
        expect(gap.body.entries[0].id).toBe(second.body.entry.id);
    });

    it('rejects an unauthenticated post with 401', async () => {
        const { incidentId } = await setup();
        const res = await request(app)
            .post(`/incidents/${incidentId}/timeline`)
            .send({ type: 'observation', body: { text: 'x' } });
        expect(res.status).toBe(401);
    });

    it("can't post to or read another org's incident (404)", async () => {
        const { auth } = await setup(); // our user is in 'Demo Team'

        const {
            rows: [otherOrg],
        } = await pool.query("INSERT INTO orgs (name) VALUES ('Other Org') RETURNING id");
        const {
            rows: [otherIncident],
        } = await pool.query(
            "INSERT INTO incidents (org_id, title, severity) VALUES ($1, 'secret', 'P2') RETURNING id",
            [otherOrg.id]
        );

        try {
            const post = await request(app)
                .post(`/incidents/${otherIncident.id}/timeline`)
                .set(auth)
                .send({ type: 'observation', body: { text: 'x' } });
            expect(post.status).toBe(404);

            const get = await request(app)
                .get(`/incidents/${otherIncident.id}/timeline`)
                .set(auth);
            expect(get.status).toBe(404);
        } finally {
            await pool.query('DELETE FROM incidents WHERE id = $1', [otherIncident.id]);
            await pool.query('DELETE FROM orgs WHERE id = $1', [otherOrg.id]);
        }
    });

    it('broadcasts entry:new to a client joined to the incident room', async () => {
        const { token, auth, incidentId } = await setup();

        await new Promise<void>((resolve, reject) => {
            const client = ioc(`http://localhost:${port}`, { auth: { token }, reconnection: false });
            clients.push(client);
            client.on('connect_error', (err) => reject(new Error(`connect failed: ${err.message}`)));

            // the broadcast we're waiting for
            client.on('entry:new', (entry) => {
                try {
                    expect(entry.incident_id).toBe(incidentId);
                    expect(entry.type).toBe('observation');
                    resolve();
                } catch (e) {
                    reject(e);
                }
            });

            // join the incident's room, then POST an entry — the handler should push it to this room
            client.emit('join-room', incidentId);
            client.on('success', () => {
                request(app)
                    .post(`/incidents/${incidentId}/timeline`)
                    .set(auth)
                    .send({ type: 'observation', body: { text: 'live' } })
                    .end(() => {});
            });
        });
    });
});
