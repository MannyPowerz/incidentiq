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