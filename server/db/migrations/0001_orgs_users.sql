-- 0001_orgs_users.sql — tenancy batch: orgs, then users.
-- In-file order IS dependency order — statements run top-to-bottom, and
-- users.org_id can't exist before orgs does.
CREATE EXTENSION IF NOT EXISTS citext;
-- orgs — the tenant root: users and incidents hang off it via org_id. Exists so the tenant boundary is real from day one instead of retrofitted later.
CREATE TABLE orgs (
  id BIGSERIAL PRIMARY KEY,
  -- BIGSERIAL: FK columns pointing here (e.g. incidents.org_id BIGINT) must type-match exactly
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Seed, not test fixture: tests/setup.ts truncates users/incidents/etc. but deliberately NOT orgs, and schema.test.ts asserts exactly one org named 'Demo Team' — 
-- this row is the permanent demo tenant everything leans on.
-- Seeded in-migration (vs a separate seed file or test setup) so schema and tenant commit atomically; fine while there's no production to pollute.
INSERT INTO orgs (name)
VALUES ('Demo Team');
-- ****************************************************
-- users — TO BE WRITTEN (see docs/architecture.md schema):
--   id, email, password_hash, role (responder|lead|admin), org_id, created_at
CREATE TABLE users (
  id BIGSERIAL PRIMARY KEY,
  email CITEXT NOT NULL UNIQUE,
  -- Waiting on auth code (not built yet): stores the hash string that code produces, never the plaintext password.
  -- The algorithm choice (bcrypt/argon2/scrypt) is made in that auth code via /options, not here — TEXT just holds whatever it outputs.
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL,
  org_id BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- ON DELETE RESTRICT: an org can't be deleted while it still owns users — guards the tenant boundary against orphaning live data.
  CONSTRAINT users_org_id_fkey FOREIGN KEY (org_id) REFERENCES orgs(id) ON DELETE RESTRICT,
  CONSTRAINT users_role_check CHECK (role IN ('responder', 'lead', 'admin'))
);
-- refresh_tokens — requested by a teammate to back JWT refresh support (JWT_REFRESH_SECRET already sits unused in .env.example).
--
-- Approach: a DB row per issued refresh token, so a token can be individually revoked.
--   ↳ vs. stateless refresh JWTs (no table, just a longer-lived signed token) — weighed and passed over: a stateless
--     token is valid until it naturally expires, with no way to kill one early short of rotating the shared signing
--     secret for every user at once. A row is what makes "log out this device" or "log out everywhere" possible.
-- Look up: this is ADR-worthy now that it's live, not just sketched — draft 0004 once the auth route that inserts
--   into this table actually exists, so the ADR describes a real decision instead of a still-hypothetical one.
--
-- Intended for (not yet wired — no auth code exists yet): a login/refresh route inserts a row per issued token and
-- reads back by token_hash to validate a refresh request.
CREATE TABLE refresh_tokens (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL,

  -- Hash, never the raw token — same never-store-the-secret principle as users.password_hash. The hashing
  -- algorithm is an auth-code decision, not a schema one; TEXT just holds whatever that code produces.
  token_hash TEXT NOT NULL,

  -- expires_at is the token's built-in lifetime (checked automatically on every use); revoked_at is a separate,
  -- explicit kill switch (logout, rotation) — a token can be un-expired but revoked, or vice versa. Don't collapse
  -- these into one column: they answer different questions ("is this still fresh?" vs "did someone kill it?").
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,  -- nullable: NULL means still valid; set (not deleted) on logout/rotation, which keeps a revocation audit trail instead of erasing it

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- ON DELETE CASCADE, unlike the SET NULL pattern used for users.created_by/resolved_by elsewhere in this schema:
  -- those preserve a historical record after the user is gone; a refresh token has zero value with no user to
  -- refresh a session for, so there is nothing here worth preserving.
  CONSTRAINT refresh_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);