/**
 * tokens.ts — makes and checks the two kinds of login token.
 *
 * The access token is a short-lived signed pass the user carries on every request.
 * The refresh token is a long-lived random string; we only ever store its fingerprint
 * (a hash), never the string itself — so a leaked database still can't be used to log in.
 * These are pure helpers: no database, no request/response — the routes wire them together.
 */

import { randomBytes, createHash } from 'node:crypto';
import jwt from 'jsonwebtoken';
import type { AccessTokenPayload } from './types.js';
import { ACCESS_TOKEN_TTL, REFRESH_TOKEN_TTL_MS } from '../constants/auth.js';

const ACCESS_TOKEN_SECRET = process.env.JWT_SECRET;//deleted '!' operater due to silencing the type compiler and preventing silenced errors

export function signAccessToken(payload: AccessTokenPayload): string {
  //validating environment variable is safer and preventing error: "secretOrPrivateKey must have a value" during testing
  if(!ACCESS_TOKEN_SECRET) {
    throw new Error("Access token was not given")
  }
  return jwt.sign(payload, ACCESS_TOKEN_SECRET, { expiresIn: ACCESS_TOKEN_TTL });
}

// undoes signAccessToken: confirms the pass is genuine and unexpired, and hands back what's
// inside it. If it's fake or expired it throws instead of returning — requireAuth catches
// that and turns it into the right error.
export function verifyAccessToken(token: string): AccessTokenPayload {
  if(!ACCESS_TOKEN_SECRET) {
    throw new Error("Access token was not given")
  }
  return jwt.verify(token, ACCESS_TOKEN_SECRET) as AccessTokenPayload;
}

export function signRefreshToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashRefreshToken(rawToken: string): string {
  const digestString = createHash('sha256').update(rawToken).digest('hex');
  return digestString;
}

// every stored token needs an expiry date. Add the lifetime to "now" as plain milliseconds,
// then wrap it back into a Date — which is the form the database column (TIMESTAMPTZ) wants.
export function refreshTokenExpiry(): Date {
  return new Date(Date.now() + REFRESH_TOKEN_TTL_MS);
}
