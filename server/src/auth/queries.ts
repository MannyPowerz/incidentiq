/**
 * queries.ts — every database read and write the auth routes need, in one place.
 *
 * Kept separate from the handlers and the middleware on purpose: the handlers decide
 * what should happen, and these functions are the only things that actually talk to the
 * database (through the shared pool). They hand back plain rows — no request/response here.
 */

import { pool } from '../db/pool.js';
import type { User } from './types.js';

// find one user by email; null if nobody matches. email is stored as CITEXT, so the match
// is case-insensitive on its own — no need to lowercase anything first.
export async function findUserByEmail(email: string): Promise<User | null> {
    const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    return rows[0] ?? null;
}

// find one user by id; null if that row is gone
export async function findUserById(id: number): Promise<User | null> {
    const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    return rows[0] ?? null;
}

// look up an org's id by its name — used to drop new signups into the seeded 'Demo Team'
// rather than assuming it's id 1 (row order isn't guaranteed)
export async function findOrgIdByName(name: string): Promise<number> {
    const { rows } = await pool.query('SELECT id FROM orgs WHERE name = $1', [name]);
    return rows[0].id;
}

// create a user and hand back the finished row. RETURNING * gives us that new row (with its
// id) in the same round trip. New signups start as 'responder' — must be one of the roles
// the database's CHECK rule allows.
export async function insertUser(
    email: string,
    passwordHash: string,
    orgId: number
): Promise<User> {
    const { rows } = await pool.query(
        'INSERT INTO users (email, password_hash, org_id, role) VALUES ($1, $2, $3, $4) RETURNING *',
        [email, passwordHash, orgId, 'responder']
    );
    return rows[0];
}

// save a refresh token. We store only its fingerprint (the hash), never the token itself —
// so a leaked database still can't be used to log in.
export async function insertRefreshToken(
    userId: number,
    tokenHash: string,
    expiresAt: Date
): Promise<void> {
    await pool.query(
        'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
        [userId, tokenHash, expiresAt]
    );
}

// three checks in one lookup: does this token exist, was it not logged out early
// (revoked_at), and has it not run past its expiry yet
export async function findValidRefreshToken(tokenHash: string) {
    const { rows } = await pool.query(
        'SELECT * FROM refresh_tokens WHERE token_hash = $1 AND revoked_at IS NULL AND expires_at > now()',
        [tokenHash]
    );
    return rows[0] ?? null;
}

// mark a refresh token as logged out. We set a revoked_at time instead of deleting the row,
// so there's still a record that it existed.
export async function revokeRefreshToken(tokenHash: string): Promise<void> {
    await pool.query('UPDATE refresh_tokens SET revoked_at = now() WHERE token_hash = $1', [
        tokenHash,
    ]);
}
