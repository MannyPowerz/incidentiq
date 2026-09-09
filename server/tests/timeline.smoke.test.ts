import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import jwt from 'jsonwebtoken';
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
    
    //decoding token to get user_id
    const decoding = jwt.decode(token) as {sub: string, org_id: string, role: string};
    const userId = Number(decoding.sub)

    const created = await request(app)
        .post('/incidents')
        .set({ Authorization: `Bearer ${token}` })
        .send({ title: 'DB down', severity: 'P1' });
    return { token, auth: { Authorization: `Bearer ${token}` }, incidentId: created.body.incident.id, userId: userId };
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

    // ADR 0014: 'ai_draft' and 'system' have no human author (migration 0002), but this route used
    // -> to stamp the caller's token as author_id regardless of type, so any client could POST an
    // -> 'ai_draft' and get a row that was machine-typed with a human author_id. The schema now
    // -> excludes both, so the request never reaches the handler that would have done that.
    it.each(['ai_draft', 'system'])('rejects a client-posted %s entry with 400', async (type) => {
        const { auth, incidentId } = await setup();
        const res = await request(app)
            .post(`/incidents/${incidentId}/timeline`)
            .set(auth)
            .send({ type, body: { text: 'x' } });
        expect(res.status).toBe(400);
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

    it('broadcasts "new-message" to a client joined to the incident room', async () => {
        const { token, auth, incidentId } = await setup();

        await new Promise<void>((resolve, reject) => {
            const client = ioc(`http://localhost:${port}`, { auth: { token }, reconnection: false });
            clients.push(client);
            client.on('connect_error', (err) => reject(new Error(`connect failed: ${err.message}`)));

            // the broadcast we're waiting for
            client.on('new-message', (entry) => {
                try {
                    expect(entry.incident_id).toBe(incidentId);
                    expect(entry.type).toBe('observation');
                    resolve();
                } catch (e) {
                    reject(e);
                }
            });

            // join the incident's room, then POST an entry — the handler should push it to this room
            client.emit('join-room', {incidentId, sinceId: undefined});
            client.on('success', () => {
                request(app)
                    .post(`/incidents/${incidentId}/timeline`)
                    .set(auth)
                    .send({ type: 'observation', body: { text: 'live' } })
                    .end(() => {});
            });
        });
    });

    it('confirms/updates author_id', async() => {
        const { auth, incidentId, userId} = await setup();

        const { 
            rows: [aiEntry]
        } = await pool.query(`INSERT INTO timeline_entries (incident_id, author_id, type, body) VALUES($1, $2, $3, $4) RETURNING id`,
            [incidentId, null, 'ai_draft', {}]
        )

        const { 
            rows: [observationEntry]
        } = await pool.query(`INSERT INTO timeline_entries (incident_id, author_id, type, body) VALUES($1, $2, $3, $4) RETURNING id`,
            [incidentId, null, 'action', {text: 'hi'}]
        )

        try {
            const update = await request(app)
                .patch(`/incidents/${incidentId}/timeline/${aiEntry.id}/confirmed`)
                .set(auth)
            expect(update.status).toBe(200)
            expect(update.body.type).toBe('ai_draft')
            expect(update.body.author_id).toBe(userId)

            // throws and denies access for non-ai entries 
            const otherUpdate = await  request(app)
                .patch(`/incidents/${incidentId}/timeline/${observationEntry.id}/confirmed`)
                .set(auth)
            expect(otherUpdate.status).toBe(409)
            expect(otherUpdate.body.error).toMatch('not_ai_draft')
        }finally{ 
            await pool.query(`DELETE FROM timeline_entries WHERE id = $1`, [aiEntry.id])
        }
    })

    it('deletes an entry', async() => {
        const { auth, incidentId, userId} = await setup()

        const { 
            rows: [entry]
        } = await pool.query(`INSERT INTO timeline_entries (incident_id, author_id, type, body) VALUES($1, $2, $3, $4) RETURNING id`,
            [incidentId, null, 'ai_draft', {}]
        )

        const deleting = await request(app)
            .delete(`/incidents/${incidentId}/timeline/${entry.id}/rejected`)
            .set(auth)
        expect(deleting.status).toBe(200)
        expect(deleting.body.author_id).toBe(null)
    })
});
