// handleRegister — the "sign up" endpoint: make an account, then log the person in.

import type { Request, Response } from 'express';
import { hashPassword } from '../hash.js';
import {
    signAccessToken,
    signRefreshToken,
    hashRefreshToken,
    refreshTokenExpiry,
} from '../tokens.js';
import { findUserByEmail, insertUser, findOrgIdByName, insertRefreshToken } from '../queries.js';
import { REFRESH_TOKEN_TTL_MS } from '../../constants/auth.js';

export async function handleRegister(req: Request, res: Response) {
    const { email, password } = req.body; // already screened by validateBody(credentialsSchema)

    const existing = await findUserByEmail(email);
    if (existing) {
        // the email's already in use — the request itself was fine, it just collides with someone
        // who already signed up (a 409 Conflict, not a 400 bad-input)
        res.status(409).json({
            error: 'email_taken',
            message: 'An account with this email already exists',
        });
        return;
    }

    const passwordHash = await hashPassword(password);

    // every new user joins the seeded 'Demo Team' for now
    const orgId = await findOrgIdByName('Demo Team');

    const user = await insertUser(email, passwordHash, orgId);

    // hand out both tokens — same steps as login, worth pulling into one shared helper later
    const accessToken = signAccessToken({
        sub: String(user.id),
        org_id: user.org_id,
        role: user.role,
    });
    const rawRefresh = signRefreshToken();
    await insertRefreshToken(user.id, hashRefreshToken(rawRefresh), refreshTokenExpiry());

    // give the long-lived token back as a cookie page scripts can't read (httpOnly) and that
    // browsers won't send from other sites (sameSite) — so an injected script can't steal it, and
    // a forged cross-site request can't ride on it. The short-lived token goes in the body. (Option 3.)
    res.cookie('refreshToken', rawRefresh, {
        httpOnly: true,
        sameSite: 'strict',
        secure: process.env.NODE_ENV === 'production', // only require HTTPS in production; dev has none
        maxAge: REFRESH_TOKEN_TTL_MS,
    });
    res.status(201).json({ accessToken });
}
