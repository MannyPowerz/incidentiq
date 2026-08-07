/**
 * fingerprints.smoke.test.ts — both endpoints driven over HTTP.
 *
 * fingerprints.queries.test.ts already proves the upsert itself. What is only reachable from here
 * is the wiring: that the handlers read the right keys off the body, that identity really comes off
 * the token, and that the query-param guard rejects what it claims to.
 */

import { describe, it, expect } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { pool } from '../src/db/pool.js';
import { authRouter } from '../src/auth/routes/index.js';
import { fingerprintsRouter } from '../src/fingerprints/routes/index.js';

// Same wiring index.ts uses, minus sockets and the listener. authRouter rides along because both
// fingerprint routes sit behind requireAuth and we need a real token to get past it.
function makeApp() {
    const app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use('/auth', authRouter);
    app.use('/fingerprints', fingerprintsRouter);
    return app;
}

async function registerAndToken(app: express.Express, creds: { email: string; password: string }) {
    const res = await request(app).post('/auth/register').send(creds);
    return res.body.accessToken as string;
}

const creds = { email: 'fingerprint@example.com', password: 'password123' };

const fullBody = {
    project_id: 'incidentiq',
    node_version: '22.11.0',
    os_arch: 'darwin-arm64',
    lockfile_hash: 'sha256:aaa',
    applied_migrations: ['0001_orgs_users.sql'],
};

describe('fingerprints smoke test', () => {
    it('publishes, then reads it back with the publisher attached', async () => {
        const app = makeApp();
        const auth = { Authorization: `Bearer ${await registerAndToken(app, creds)}` };

        const put = await request(app).put('/fingerprints').set(auth).send(fullBody);
        expect(put.status).toBe(200);
        expect(put.body.fingerprint.id).toBeTypeOf('number');
        expect(put.body.fingerprint.node_version).toBe('22.11.0');

        const got = await request(app).get('/fingerprints?project=incidentiq').set(auth);
        expect(got.status).toBe(200);
        expect(got.body.fingerprints).toHaveLength(1);
        expect(got.body.fingerprints[0].published_by).toBe(creds.email);
    });

    // the handler-level version of the query test: the fields have to survive the trip through
    // -> req.body, which is where a mis-spelled destructure would silently drop them.
    it('stores every field sent, not just the ones the handler happens to name', async () => {
        const app = makeApp();
        const auth = { Authorization: `Bearer ${await registerAndToken(app, creds)}` };

        const put = await request(app).put('/fingerprints').set(auth).send(fullBody);

        expect(put.body.fingerprint.os_arch).toBe('darwin-arm64');
        expect(put.body.fingerprint.lockfile_hash).toBe('sha256:aaa');
        expect(put.body.fingerprint.applied_migrations).toEqual(['0001_orgs_users.sql']);
    });

    it('republishing overwrites instead of adding a second row', async () => {
        const app = makeApp();
        const auth = { Authorization: `Bearer ${await registerAndToken(app, creds)}` };

        await request(app).put('/fingerprints').set(auth).send(fullBody);
        await request(app)
            .put('/fingerprints')
            .set(auth)
            .send({ ...fullBody, node_version: '20.18.1' });

        const got = await request(app).get('/fingerprints?project=incidentiq').set(auth);
        expect(got.body.fingerprints).toHaveLength(1);
        expect(got.body.fingerprints[0].node_version).toBe('20.18.1');
    });

    // full replace: a field left out of the republish is cleared, not carried over.
    it('clears a field the republish left out', async () => {
        const app = makeApp();
        const auth = { Authorization: `Bearer ${await registerAndToken(app, creds)}` };

        await request(app).put('/fingerprints').set(auth).send(fullBody);
        const second = await request(app)
            .put('/fingerprints')
            .set(auth)
            .send({ project_id: 'incidentiq', node_version: '20.18.1' });

        expect(second.body.fingerprint.os_arch).toBeNull();
        expect(second.body.fingerprint.lockfile_hash).toBeNull();
        expect(second.body.fingerprint.applied_migrations).toBeNull();
    });

    it('rejects a body with no project_id', async () => {
        const app = makeApp();
        const auth = { Authorization: `Bearer ${await registerAndToken(app, creds)}` };

        const put = await request(app).put('/fingerprints').set(auth).send({ node_version: '22.11.0' });
        expect(put.status).toBe(400);
    });

    it('rejects both routes without a token', async () => {
        const app = makeApp();

        expect((await request(app).put('/fingerprints').send(fullBody)).status).toBe(401);
        expect((await request(app).get('/fingerprints?project=incidentiq')).status).toBe(401);
    });

    it('rejects a GET with no project param', async () => {
        const app = makeApp();
        const auth = { Authorization: `Bearer ${await registerAndToken(app, creds)}` };

        const got = await request(app).get('/fingerprints').set(auth);
        expect(got.status).toBe(400);
        expect(got.body.error).toBe('project_required');
    });

    // ?project=a&project=b arrives as an array, which is the case the typeof guard exists for.
    it('rejects a repeated project param', async () => {
        const app = makeApp();
        const auth = { Authorization: `Bearer ${await registerAndToken(app, creds)}` };

        const got = await request(app).get('/fingerprints?project=a&project=b').set(auth);
        expect(got.status).toBe(400);
        expect(got.body.error).toBe('project_required');
    });

    it('returns an empty list for a project nobody has published', async () => {
        const app = makeApp();
        const auth = { Authorization: `Bearer ${await registerAndToken(app, creds)}` };

        const got = await request(app).get('/fingerprints?project=nothing-here').set(auth);
        expect(got.status).toBe(200);
        expect(got.body.fingerprints).toEqual([]);
    });

    // the org boundary over HTTP. It lives in a JOIN rather than a WHERE on the table, so it is
    // -> worth proving from the outside as well as from the query test.
    it("never returns another org's fingerprints", async () => {
        const app = makeApp();
        const auth = { Authorization: `Bearer ${await registerAndToken(app, creds)}` };

        const {
            rows: [otherOrg],
        } = await pool.query("INSERT INTO orgs (name) VALUES ('Other Org') RETURNING id");
        const {
            rows: [outsider],
        } = await pool.query(
            `INSERT INTO users (email, password_hash, role, org_id) VALUES ('outsider@example.com', 'hash', 'responder', $1) RETURNING id`,
            [otherOrg.id]
        );

        try {
            await request(app).put('/fingerprints').set(auth).send(fullBody);
            await pool.query(
                `INSERT INTO machine_fingerprints (user_id, project_id, node_version) VALUES ($1, 'incidentiq', '99.0.0')`,
                [outsider.id]
            );

            const got = await request(app).get('/fingerprints?project=incidentiq').set(auth);

            expect(got.body.fingerprints).toHaveLength(1);
            expect(got.body.fingerprints[0].published_by).toBe(creds.email);
        } finally {
            // orgs is never truncated (schema.test.ts asserts exactly one), and its FK is
            // -> ON DELETE RESTRICT, so the user has to go before the org does.
            await pool.query('DELETE FROM machine_fingerprints WHERE user_id = $1', [outsider.id]);
            await pool.query('DELETE FROM users WHERE id = $1', [outsider.id]);
            await pool.query('DELETE FROM orgs WHERE id = $1', [otherOrg.id]);
        }
    });
});
