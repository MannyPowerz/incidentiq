// handleLogin — the "log in" endpoint: check the password, then hand back fresh tokens.

import type { Request, Response } from 'express';
import { verifyPassword } from '../hash.js';
import {
  signAccessToken,
  signRefreshToken,
  hashRefreshToken,
  refreshTokenExpiry,
} from '../tokens.js';
import { findUserByEmail, insertRefreshToken } from '../queries.js';
import { REFRESH_TOKEN_TTL_MS } from '../../constants/auth.js';

export async function handleLogin(req: Request, res: Response) {
  const { email, password } = req.body;

  const user = await findUserByEmail(email);

  // same reply whether the email is unknown or the password is wrong — saying which would let
  // someone fish for valid emails. Check "no user" first so we never read a password off nothing.
  if (!user || !(await verifyPassword(password, user.password_hash))) {
    res.status(401).json({ error: 'invalid_credentials', message: 'Invalid email or password' });
    return;
  }

  // the failure above already returned, so this only runs on success — same tokens + cookie as register
  const accessToken = signAccessToken({
    sub: String(user.id),
    org_id: user.org_id,
    role: user.role,
  });
  const rawRefresh = signRefreshToken();
  await insertRefreshToken(user.id, hashRefreshToken(rawRefresh), refreshTokenExpiry());

  res.cookie('refreshToken', rawRefresh, {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    maxAge: REFRESH_TOKEN_TTL_MS,
  });
  res.status(200).json({ accessToken });
}
