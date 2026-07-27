import { describe, it, expect } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { authRouter } from '../src/auth/routes/index.js';

// Rebuild the same wiring index.ts uses (JSON body parsing, cookie parsing, the auth
// router mounted at /auth), minus the server listener — so supertest can drive the auth
// stack in-process against the throwaway test database.
function makeApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/auth', authRouter);
  return app;
}

describe('auth smoke test', () => {
  const creds = { email: 'smoke@example.com', password: 'password123' };

  it('registers a new user, then logs them back in', async () => {
    const app = makeApp();

    const register = await request(app).post('/auth/register').send(creds);
    expect(register.status).toBe(201);
    expect(register.body.accessToken).toBeTypeOf('string');
    expect(register.headers['set-cookie']?.[0]).toMatch(/refreshToken=/);

    const login = await request(app).post('/auth/login').send(creds);
    expect(login.status).toBe(200);
    expect(login.body.accessToken).toBeTypeOf('string');
  });

  it('rejects a second signup with the same email as 409', async () => {
    const app = makeApp();

    await request(app).post('/auth/register').send(creds); // first one wins
    const dup = await request(app).post('/auth/register').send(creds);

    expect(dup.status).toBe(409);
    expect(dup.body.error).toBe('email_taken');
  });

  it('trades a valid refresh cookie for a new access token', async () => {
    const app = makeApp();

    const register = await request(app).post('/auth/register').send(creds);
    const cookie = register.headers['set-cookie'];

    const refresh = await request(app).post('/auth/refresh').set('Cookie', cookie);
    expect(refresh.status).toBe(200);
    expect(refresh.body.accessToken).toBeTypeOf('string');
  });

  it('logs out, then rejects the now-revoked refresh token', async () => {
    const app = makeApp();

    const register = await request(app).post('/auth/register').send(creds);
    const cookie = register.headers['set-cookie'];

    const logout = await request(app).post('/auth/logout').set('Cookie', cookie);
    expect(logout.status).toBe(204);

    // the refresh row was revoked, so the same cookie no longer works
    const afterLogout = await request(app).post('/auth/refresh').set('Cookie', cookie);
    expect(afterLogout.status).toBe(401);
    expect(afterLogout.body.error).toBe('refresh_token_invalid');
  });
});
