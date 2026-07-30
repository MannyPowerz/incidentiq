import { describe, it, expect } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { pool } from '../src/db/pool.js';
import { authRouter } from '../src/auth/routes/index.js';
import { incidentRouter } from '../src/incidents/routes/index.js';

// Rebuild the same wiring index.ts uses, minus the socket server and listener, so supertest
// can drive the incident routes in-process. authRouter is here too because every incident
// route is behind requireAuth — we register a user to mint the access token the routes demand.
function makeApp() {
    const app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use('/auth', authRouter);
    app.use('/incidents', incidentRouter);
    return app;
}

// register a fresh user and hand back their access token (the Bearer the incident routes require)
async function registerAndToken(app: express.Express, creds: { email: string; password: string }) {
    const res = await request(app).post('/auth/register').send(creds);
    return res.body.accessToken as string;
}

describe('incident rooms smoke test', () => {
    const creds = { email: 'incident@example.com', password: 'password123' };

    it('creates, gets, lists, then resolves an incident', async () => {
        const app = makeApp();
        const token = await registerAndToken(app, creds);
        const auth = { Authorization: `Bearer ${token}` };

        // CREATE — 201, status defaults to 'detected', id comes back as a real number (proves the int8 parser)
        const created = await request(app)
            .post('/incidents')
            .set(auth)
            .send({ title: 'DB down', severity: 'P1', affected_system: 'postgres' });
        expect(created.status).toBe(201);
        expect(created.body.incident.id).toBeTypeOf('number');
        expect(created.body.incident.status).toBe('detected');
        const id = created.body.incident.id;

        // GET the one we just made — 200
        const got = await request(app).get(`/incidents/${id}`).set(auth);
        expect(got.status).toBe(200);
        expect(got.body.incident.title).toBe('DB down');

        // LIST — our org has exactly the one incident
        const list = await request(app).get('/incidents').set(auth);
        expect(list.status).toBe(200);
        expect(list.body.incidents).toHaveLength(1);
        expect(list.body.incidents[0].id).toBe(id);

        // RESOLVE — status flips and resolved_at gets stamped
        const resolved = await request(app)
            .patch(`/incidents/${id}`)
            .set(auth)
            .send({ status: 'resolved' });
        expect(resolved.status).toBe(200);
        expect(resolved.body.incident.status).toBe('resolved');
        expect(resolved.body.incident.resolved_at).not.toBeNull();
    });

    it('rejects an unauthenticated create with 401', async () => {
        const app = makeApp();
        // no Authorization header — requireAuth turns it away before the handler runs
        const res = await request(app).post('/incidents').send({ title: 'x', severity: 'P1' });
        expect(res.status).toBe(401);
    });

    it('rejects a malformed body with 400', async () => {
        const app = makeApp();
        const token = await registerAndToken(app, creds);
        // empty title and a severity outside P1..P4 — validateBody rejects before the handler
        const res = await request(app)
            .post('/incidents')
            .set({ Authorization: `Bearer ${token}` })
            .send({ title: '', severity: 'P9' });
        expect(res.status).toBe(400);
    });

    it("can't see or resolve another org's incident (404, not 403)", async () => {
        const app = makeApp();
        const token = await registerAndToken(app, creds); // this user is in 'Demo Team'
        const auth = { Authorization: `Bearer ${token}` };

        // hand-build an incident owned by a DIFFERENT org. created_by is nullable, so no user needed.
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
            // it exists in the DB, but our token's org can't see it — same 404 as if it were missing,
            // so a caller can't tell "not yours" apart from "doesn't exist" and probe other orgs' ids
            const got = await request(app).get(`/incidents/${otherIncident.id}`).set(auth);
            expect(got.status).toBe(404);

            const resolve = await request(app)
                .patch(`/incidents/${otherIncident.id}`)
                .set(auth)
                .send({ status: 'resolved' });
            expect(resolve.status).toBe(404);
        } finally {
            // orgs isn't truncated between tests (schema.test.ts asserts exactly one org),
            // so delete the rows we inserted by hand — incident first (orgs FK is ON DELETE RESTRICT)
            await pool.query('DELETE FROM incidents WHERE id = $1', [otherIncident.id]);
            await pool.query('DELETE FROM orgs WHERE id = $1', [otherOrg.id]);
        }
    });
});
