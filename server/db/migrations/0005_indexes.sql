-- 0005_indexes.sql — indexes for the two columns filtered on nearly every read.
-- No CREATE INDEX exists anywhere before this file.
--
-- Plain CREATE INDEX, not CONCURRENTLY: migrate.ts wraps every file in BEGIN/COMMIT
-- (migrate.ts:61,72), and CONCURRENTLY cannot run inside a transaction block at all 
-- Postgres errors immediately rather than warning and continuing. 
-- CONCURRENTLY avoids locking a table under live write traffic — this schema has none yet, so the restriction costs nothing real today. Revisit only if this ever runs against a table with production traffic.
-- Matches every org_id filter in incidents/queries.ts — get, list, and resolve.
CREATE INDEX incidents_org_id_idx ON incidents (org_id);
-- Matches every incident_id filter in timeline/queries.ts — the full list and the reconnect gap-fill.
CREATE INDEX timeline_entries_incident_id_idx ON timeline_entries (incident_id);