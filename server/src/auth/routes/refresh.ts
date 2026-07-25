// handleRefresh — the "stay logged in" endpoint: trade a valid refresh token for a new
// short-lived access token, so the user doesn't have to type their password again.

import type { Request, Response } from 'express';
import { signAccessToken, hashRefreshToken } from '../tokens.js';
import { findValidRefreshToken, findUserById } from '../queries.js';

export async function handleRefresh(req: Request, res: Response) {
  const rawRefresh = req.cookies.refreshToken; // only readable once cookie-parser is mounted in index.ts

  if (!rawRefresh) {
    res.status(401).json({ error: 'refresh_token_missing', message: 'No refresh token provided' });
    return;
  }

  // no match means the token expired, was logged out, or never existed — all the same "no"
  const row = await findValidRefreshToken(hashRefreshToken(rawRefresh));
  if (!row) {
    res
      .status(401)
      .json({ error: 'refresh_token_invalid', message: 'Refresh token expired or revoked' });
    return;
  }

  // the token checks out but the person behind it is gone
  const user = await findUserById(row.user_id);
  if (!user) {
    res.status(401).json({ error: 'user_not_found', message: 'User no longer exists' });
    return;
  }

  // hand back only a fresh short-lived token; the long-lived cookie keeps working until it
  // expires on its own. Swapping it out every time (rotation) is safer but skipped for now.
  const accessToken = signAccessToken({
    sub: String(user.id),
    org_id: user.org_id,
    role: user.role,
  });
  res.status(200).json({ accessToken });
}
