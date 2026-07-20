-- 0003_diagnoses_resolutions.sql — incident outcomes batch: diagnoses, then resolutions.
-- Runs after 0002 because both FK into incidents(id).

-- diagnoses — AI-produced analysis of an incident.
-- Rows arrive only after Zod validation upstream (CLAUDE.md: AI output is never trusted raw), so the DB stays lenient on the optional text fields.
CREATE TABLE diagnoses (
  id BIGSERIAL PRIMARY KEY,
  incident_id BIGINT NOT NULL,
  explanation TEXT NOT NULL,              -- the one field a diagnosis is pointless without; the rest may be absent on a weak AI draft
  
  root_cause TEXT,
  suggested_fix TEXT,
  root_cause_category TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- ON DELETE CASCADE: a diagnosis is analysis OF an incident — orphaned analysis is noise.
  CONSTRAINT diagnoses_incident_id_fkey FOREIGN KEY (incident_id) REFERENCES incidents(id) ON DELETE CASCADE
);

-- resolutions — how an incident was closed out; what the archive search mines to surface "a past incident like this was fixed by...".
CREATE TABLE resolutions (
  id BIGSERIAL PRIMARY KEY,
  incident_id BIGINT NOT NULL,
  summary TEXT NOT NULL,
  root_cause TEXT,
  resolved_by BIGINT,                     -- nullable: same author pattern as incidents.created_by — the record outlives the person
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- ON DELETE CASCADE: same reasoning as diagnoses — a resolution of a deleted incident answers a question nobody can ask anymore.
  CONSTRAINT resolutions_incident_id_fkey FOREIGN KEY (incident_id) REFERENCES incidents(id) ON DELETE CASCADE,

  CONSTRAINT resolutions_resolved_by_fkey FOREIGN KEY (resolved_by) REFERENCES users(id) ON DELETE SET NULL
);
