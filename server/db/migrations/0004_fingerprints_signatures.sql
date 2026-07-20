-- 0004_fingerprints_signatures.sql — scanner batch: machine_fingerprints, then signatures_detected.
-- Runs last: fingerprints FK into users(id); signatures_detected FKs into incidents(id) and machine_fingerprints(id).
-- machine_fingerprints — one row per (user, project): the environment snapshot Tier 2 signatures diff against.
CREATE TABLE machine_fingerprints (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL,
  project_id TEXT NOT NULL,
  -- plain identifier, no FK: a projects table was weighed and dropped as scope creep beyond the 8-table Minimum; a later migration can add the FK if projects ever become real
  node_version TEXT,
  os_arch TEXT,
  lockfile_hash TEXT,
  applied_migrations JSONB,
  -- JSONB, same call as timeline_entries.body: MIGRATION_DRIFT compares inside this list
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- refreshed by app code on republish (PUT /api/fingerprints); a DB trigger was weighed and skipped as more machinery than Minimum needs
  -- ON DELETE CASCADE: a fingerprint describes one user's machine — without the user it describes nothing.
  CONSTRAINT machine_fingerprints_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  -- PUT /api/fingerprints is an upsert: one fingerprint per user per project, and this is the conflict target that makes republishing overwrite instead of pile up.
  CONSTRAINT machine_fingerprints_user_project_key UNIQUE (user_id, project_id)
);
-- signatures_detected — every signature firing, posted or not; what "similar past incident" surfacing mines.
CREATE TABLE signatures_detected (
  id BIGSERIAL PRIMARY KEY,
  incident_id BIGINT,
  -- nullable by design: a detection exists before (and whether or not) a human posts it to an incident — the human gate invariant
  signature_id TEXT NOT NULL,
  -- registry key, e.g. 'VPN_LOOPBACK' — must match a signature object's id in the scanner registry
  tier SMALLINT NOT NULL,
  machine_fingerprint_id BIGINT,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- SET NULL, not CASCADE: detections are history worth keeping even after the incident or fingerprint they came from is gone.
  CONSTRAINT signatures_detected_incident_id_fkey FOREIGN KEY (incident_id) REFERENCES incidents(id) ON DELETE
  SET NULL,
    CONSTRAINT signatures_detected_fingerprint_fkey FOREIGN KEY (machine_fingerprint_id) REFERENCES machine_fingerprints(id) ON DELETE
  SET NULL,
    CONSTRAINT signatures_detected_tier_check CHECK (tier IN (1, 2))
);