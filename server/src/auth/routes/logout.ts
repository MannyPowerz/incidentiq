// handleLogout — the "log out" endpoint: kill the refresh token so it can't be used again.

import type { Request, Response } from 'express';
import { hashRefreshToken } from '../tokens.js';
import { revokeRefreshToken } from '../queries.js';

export async function handleLogout(req: Request, res: Response) {
    const rawRefresh = req.cookies.refreshToken;

    // only revoke if a token was actually sent — logging out with none still succeeds
    if (rawRefresh) {
        await revokeRefreshToken(hashRefreshToken(rawRefresh));
    }

    res.clearCookie('refreshToken'); // kill it in the database above, drop the browser's copy here
    res.status(204).send();
}
