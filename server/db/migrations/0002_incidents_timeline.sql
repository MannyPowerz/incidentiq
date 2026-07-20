-- 0002_incidents_timeline.sql — incident core batch: incidents, then timeline_entries.
-- Runs after 0001 because incidents FKs into orgs(id) and users(id).

CREATE TABLE incidents (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'detected',
  org_id BIGINT NOT NULL,                 -- tenant key; NOT NULL — every incident belongs to an org
  severity TEXT NOT NULL,
  created_by BIGINT,                      -- nullable on purpose: see ON DELETE SET NULL below
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  affected_system TEXT,
  resolved_at TIMESTAMPTZ,

  -- ON DELETE RESTRICT: an org can't be deleted while it still owns incidents — guards the tenant boundary against orphaning live data.
  CONSTRAINT incidents_org_id_fkey FOREIGN KEY (org_id) REFERENCES orgs(id) ON DELETE RESTRICT,

  -- severity is TEXT + CHECK, not a Postgres ENUM: a CHECK is widened with a plain migration, an ENUM needs ALTER TYPE. Keep any app-side severity list in sync.
  CONSTRAINT incidents_severity_check CHECK (severity IN ('P1','P2','P3','P4')),

  -- ON DELETE SET NULL: if the authoring user is deleted, keep the incident (the audit trail outlives the author) and just null out created_by.
  CONSTRAINT incidents_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,

  CONSTRAINT incidents_status_check CHECK (status IN ('detected','investigating','mitigated','resolved','postmortem'))

);

-- timeline_entries — the war-room timeline itself: one row per posted entry.
CREATE TABLE timeline_entries (
  id BIGSERIAL PRIMARY KEY,               -- the ordering truth: timelines sort by (incident_id, id), NEVER by socket arrival time (CLAUDE.md invariant; schema.test.ts covers it)
  
  incident_id BIGINT NOT NULL,
  author_id BIGINT,                       -- nullable on purpose: 'system' and 'ai_draft' entries have no human author

  type TEXT NOT NULL,
  body JSONB NOT NULL,                    -- JSONB over JSON: indexable/queryable inside (summary, why_it_matters, likely_fix) and matches the ::jsonb cast schema.test.ts already uses; byte-exact input formatting isn't worth keeping

  locked BOOLEAN NOT NULL DEFAULT false,  -- just the flag; the "immutable after 30 min" rule is app-layer behavior, unbuilt yet (same boundary as password hashing)

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- ON DELETE CASCADE, not RESTRICT: an entry has zero meaning without its incident — if the incident goes, its timeline goes with it.
  CONSTRAINT timeline_entries_incident_id_fkey FOREIGN KEY (incident_id) REFERENCES incidents(id) ON DELETE CASCADE,

  -- Same call as incidents.created_by: the record outlives the author.
  CONSTRAINT timeline_entries_author_id_fkey FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE SET NULL,

  CONSTRAINT timeline_entries_type_check CHECK (type IN ('observation','action','finding','system','ai_draft'))
);
