/**
 * middleware.ts — the two screening steps that run before a route handler.
 *
 * requireAuth: the bouncer on protected routes — no valid pass, no entry.
 * validateBody: checks an incoming request body against an expected shape and turns it away
 * early if it's wrong, so the handler can trust whatever reaches it.
 */

import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from './tokens.js';
import { z } from 'zod';

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  // pull the pass out of the "Authorization: Bearer <token>" header
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;

  if (!token) {
    // no pass was sent at all — a different case from a pass that was sent but is bad
    res.status(401).json({
      error: 'token_missing',
      message: 'No access token provided',
    });

    return;
  }

  try {
    const payload = verifyAccessToken(token);
    req.user = payload;
    next();
  } catch (err) {
    // the code matters, not just the message: 'token_expired' is the signal that tells the
    // front-end to quietly get a new pass via /refresh instead of kicking the user to login.
    if (err instanceof jwt.TokenExpiredError) {
      res.status(401).json({
        error: 'token_expired',
        message: 'Access token expired',
      });
    } else {
      // anything other than "expired" — the pass was tampered with, garbled, or signed with the wrong key
      res.status(401).json({
        error: 'token_invalid',
        message: 'Invalid access token',
      });
    }
  }
}

export function validateBody(schema: z.ZodType) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      return res.status(400).json({
        error: 'Bad Request',
        message: result.error,
      });
    } else {
      next();
    }
  };
}
