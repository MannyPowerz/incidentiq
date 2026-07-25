// shared types (User, RefreshToken, AccessTokenPayload) + the Express Request augmentation for req.user (TS needs this declared once, or `req.user` won't typecheck anywhere else)

// server/src/index.ts  — one new line: app.use('/auth', authRouter)

// Payload stays stateless (org_id + role embedded) instead of a per-request DB
// lookup — see docs/Architecture_Decision_Records/0005-access-token-payload-shape.md

export interface AccessTokenPayload {
  sub: string; // user.id, as a string
  org_id: number; // immutable per user — never stale (0001_orgs_users.sql)
  role: 'responder' | 'lead' | 'admin'; // can change — stale up to ACCESS_TOKEN_TTL after promotion/demotion
}

// Merges `user` onto Express's own Request type — without this, `req.user = payload`
// in middleware.ts doesn't typecheck anywhere in the app.
declare global {
  namespace Express {
    interface Request {
      user?: AccessTokenPayload; // optional: only set once requireAuth has run
    }
  }
}

type UserRole = 'responder' | 'lead' | 'admin';

export interface User {
  id: number; // SQL: BIGSERIAL   — see the gotcha below
  email: string; // SQL: CITEXT
  password_hash: string; // SQL: TEXT
  role: UserRole; // SQL: TEXT + CHECK ('responder','lead','admin');
  org_id: number; // SQL: BIGINT      — same gotcha as id
  created_at: Date; // SQL: TIMESTAMPTZ
}

export interface RefreshToken {
  id: number; // SQL: BIGSERIAL
  user_id: number; // SQL: BIGINT
  token_hash: string; // SQL: TEXT
  expires_at: Date; // SQL: TIMESTAMPTZ
  revoked_at: Date | null; // SQL: TIMESTAMPTZ, NULLABLE  ← the one nullable column
  created_at: Date; // SQL: TIMESTAMPTZ
}
