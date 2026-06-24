# Architecture — IncidentIQ

Source: System_Design.pdf

---

## The one rule that governs everything

The agent detects. The human decides. The database remembers. The socket delivers.

- The scanner only notices problems. It never shares anything on its own.
- A human always decides what is worth posting. Nothing auto-posts.
- The database is the single source of truth — permanent, official record.
- The socket (Socket.io) is the fast delivery wire. Not storage.

---

## The four components and their jobs

1. **Local Agent** — runs on each developer's machine. Reads the project,
   watches the environment, runs signatures, builds the fingerprint.
   Detects; never decides what to share.

2. **API + Socket Server** — the brain. Holds auth, incident logic, the
   real-time gateway, and orchestrates AI and relevance.
   The single source of truth.

3. **AI + Relevance Services** — stateless helpers the server calls.
   AI drafts and analyzes; relevance scores who-cares-about-what.

4. **React Web UI** — the war room. Renders the timeline live, shows each
   developer their personalized view, lets humans confirm before anything posts.

---

## Stack

- Backend: Node.js + Express
- Database: PostgreSQL
- Real-time: Socket.io (rooms = incidents)
- Frontend: React + Vite
- AI service: LangChain, output validated with Zod
- Auth: JWT
- Relevance: server-side, local git via child_process (no GitHub API at Minimum)
- Scanner: Node built-ins — TCP port checks, os.networkInterfaces(), file hashes
- File watching: chokidar (package-lock.json + migrations folder)

---

## Data flow — one detection start to finish

1. Agent watcher notices: port 5173 bound but not responding
2. Signature engine matches: ghost-port + new utun interface → VPN_LOOPBACK fires
3. Agent shows the developer a PRIVATE card — nothing has left the machine yet
4. Developer clicks "post to war room"
5. Agent sends detection payload → API server (REST)
6. Server calls AI service → structured draft entry returned
7. Server writes entry to PostgreSQL — now it is permanent truth
8. Server calls relevance engine → scores each teammate against this entry
9. Server emits via Socket.io → io.to(incidentRoom).emit('entry:new', ...)
10. Each teammate's UI receives it, ordered by their relevance score
11. Server checks archive for similar past signatures → surfaces past resolution if found

Steps 1–3 are local and private.
Step 4 is the human gate.
Steps 5–11 are the server doing its job.

---

## Why this shape — decisions you can defend

**Agent separate from server** — things only a local process can see (ports,
network, files) cannot be seen from a browser or cloud server. That separation
is the moat.

**Server as single source of truth** — multiple agents and browsers need one
consistent reality. Peer-to-peer was considered and rejected — it adds
distributed consistency problems for zero benefit at MVP scale.

**AI and relevance as stateless services** — they take input and return output
with no memory of their own. Trivially scalable and easy to test.

**Human gate before posting** — an agent auto-posting every detection would
flood the war room into uselessness. Signal over noise is enforced
architecturally, not by hoping.

**Write to DB before broadcast** — if you broadcast first and the DB write
fails, clients show data that does not exist on the server. Truth before
broadcast, always.

**Sort by entry_id, never by socket arrival time** — arrival order over a
network is never trustworthy. The database sequence is absolute.

---

## Database schema

```sql
users
  id, email, password_hash, role (responder|lead|admin), org_id, created_at

incidents
  id, org_id, title, severity (P1–P4),
  status (detected|investigating|mitigated|resolved|postmortem),
  affected_system, created_by, created_at, resolved_at

timeline_entries
  id, incident_id, author_id,
  type (observation|action|finding|system|ai_draft),
  body, created_at, locked (bool — immutable after 30 min)

diagnoses
  id, incident_id, explanation, root_cause,
  suggested_fix, root_cause_category, created_at

resolutions
  id, incident_id, summary, root_cause, resolved_by, created_at

signatures_detected
  id, incident_id (nullable), signature_id, tier,
  machine_fingerprint_id, payload (jsonb), created_at

machine_fingerprints
  id, user_id, project_id, node_version, os_arch,
  lockfile_hash, applied_migrations (jsonb), updated_at
```

---

## Signature system

A signature is a self-contained object. The scanner is a dumb loop that runs
whatever signatures exist. Adding a new detection means writing one new
signature object — the scanner loop never changes.

Signature {

id: string

tier: 1 | 2

severity: "info" | "warn" | "critical"

collect(): EnvSnapshot

evaluate(snapshot, peers?): null | Detection

explain(detection): string

}

**Tier 1 — self vs. project (Minimum)**

- VPN_LOOPBACK — port bound but unresponsive + new network interface detected
- ENV_VAR_MISSING — required keys in .env.example missing from local .env
- PORT_COLLISION — two local services configured for the same port

**Tier 2 — self vs. team (Minimum)**

- NODE_VERSION_DRIFT — local Node version differs from active teammates
- LOCKFILE_DRIFT — local lockfile hash differs from committed version
- MIGRATION_DRIFT — code references DB schema not yet migrated locally

---

## Real-time layer

- Rooms = incidents
- DB = truth
- Sockets = the live wire

On reconnect:

1. Socket reconnects, client re-joins its rooms
2. Client calls REST: GET /incidents/:id/timeline?since=<lastSeenId>
3. DB returns the gap, client merges, then resumes live

Sockets never replay missed history — the DB fills the gap.

---

## Relevance engine

Stateless. Input: one entry + team's recent git activity.
Output: a score and a reason string per teammate.

- Reason matters more than score — the UI shows the reason
- Recency decay — a file touched 3 months ago weighs far less than this morning
- Minimum version uses local git via child_process — zero API calls, zero tokens
