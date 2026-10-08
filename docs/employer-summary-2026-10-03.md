# IncidentIQ — Technical Summary

**As of:** 2026-10-03, `main` @ `ce28054`
**Stack:** Node.js/Express/TypeScript backend, raw `pg` (no ORM), PostgreSQL, Socket.IO, React/Vite client, Zod validation throughout.

This is a factual snapshot. Where something exists only as a type/interface or a database table with no code reading or writing it, that is stated explicitly below.

---

## API endpoints — built and working on `main`

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/auth/register` | none | creates user + org membership, returns access token + refresh cookie |
| POST | `/auth/login` | none | verifies password, returns access token + refresh cookie |
| POST | `/auth/refresh` | refresh cookie | trades refresh cookie for new access token |
| POST | `/auth/logout` | refresh cookie | revokes the refresh token |
| POST | `/incidents` | bearer token | creates an incident (title, severity, optional affected_system) |
| GET | `/incidents` | bearer token | lists incidents for the caller's org |
| GET | `/incidents/:id` | bearer token | single incident, org-scoped |
| PATCH | `/incidents/:id` | bearer token | status transition |
| POST | `/incidents/:id/timeline` | bearer token | posts a timeline entry |
| GET | `/incidents/:id/timeline` | bearer token | lists entries for an incident |
| PATCH | `/incidents/:id/timeline/:entry_id/confirmed` | bearer token | confirms an AI-drafted entry, assigns human author |
| DELETE | `/incidents/:id/timeline/:entry_id/rejected` | bearer token | rejects/deletes an unconfirmed AI draft |
| POST | `/incidents/:id/ai-draft` | bearer token | generates an AI draft via Gemini (LangChain), inserts it, broadcasts over the socket |
| PUT | `/fingerprints` | bearer token | upserts a machine environment snapshot (one per user+project) |
| GET | `/fingerprints?project=` | bearer token | lists fingerprints for a project |

All protected routes require a valid JWT access token and are scoped to the caller's `org_id` — one org cannot read or modify another org's data. Real-time delivery of new timeline entries runs over Socket.IO, authenticated the same way as the HTTP routes.

**Not built:** no endpoints for `diagnoses` or `resolutions`, despite both having database tables (below).

---

## Database — 8 tables, all migrated

`orgs`, `users`, `refresh_tokens`, `incidents`, `timeline_entries`, `diagnoses`, `resolutions`, `machine_fingerprints`, `signatures_detected`.

**Tables with working application code:** `orgs`, `users`, `refresh_tokens`, `incidents`, `timeline_entries`, `machine_fingerprints`.

**Tables that exist in the schema with no application code reading or writing them:** `diagnoses`, `resolutions`, `signatures_detected`. These were created ahead of the features that will use them and are currently unused.

Two B-tree indexes exist, on `incidents.org_id` and `timeline_entries.incident_id` — the two columns filtered on nearly every read.

---

## Authentication and permissions

- **Passwords:** bcrypt, 12 salt rounds (`bcrypt.hash` / `bcrypt.compare`), never stored or logged in plaintext.
- **Sessions:** short-lived signed JWT access token (15 min) carrying `user_id`, `org_id`, and `role`; a long-lived refresh token stored server-side as a SHA-256 hash (never the raw token), delivered to the client as an httpOnly, `SameSite=Strict` cookie. Individual refresh tokens can be revoked without affecting others.
- **Authorization:** every protected route runs a `requireAuth` middleware that verifies the JWT and attaches `{ sub, org_id, role }` to the request. Every data-access query takes `org_id` as a required parameter and filters on it — there is no code path that returns another org's rows to an authenticated user.
- **Three user roles exist in the schema** (`responder`, `lead`, `admin`) but no endpoint currently branches on role — authorization today is org-level isolation only, not role-based permissions.
- **Client-side (not yet merged to `main`):** an in-memory-only access token (never `localStorage`), automatic silent refresh on token expiry, and a route guard redirecting unauthenticated users. This work is complete and tested but sitting in an open, unreviewed pull request as of this summary.

---

## Environment scanner (the "agent")

**Status: contract only, no implementation.** The `agent/` directory contains a single TypeScript file (`types.ts`) defining the interfaces the scanner will implement: `PortProbe` (port, bound, responsive, latency), `EnvSnapShot` (node version, OS/arch, lockfile hash, applied migrations, port probes, VPN/tunnel interfaces), `Detection`, and `Signature`. **No code exists yet that opens a port, reads a file, or produces any of these values.** Two architecture decisions are recorded and ready to implement against: a dedicated per-machine credential type for the agent to authenticate with (separate from a user login), and a rule for the agent to reuse an open incident rather than creating duplicates when the same problem fires repeatedly.

---

## Tests

95 passing backend tests (Vitest + Supertest, isolated per-test via `TRUNCATE ... CASCADE` against a dedicated test database) and 31 passing frontend tests covering the unmerged client auth work, covering:

- Auth flows (register/login/refresh, token expiry/invalid/missing paths)
- Incident and timeline CRUD, including cross-org access denial
- Fingerprint upsert semantics (full-replace on republish, including a race-condition case)
- A relevance-scoring algorithm (recency/frequency/ownership weighting) — fully implemented and unit-tested, but not yet called from any API route
- Socket.IO auth and message delivery

A subset of these tests is **mutation-verified**: a test is only trusted once a deliberate bug injected into the code it covers was confirmed to make that specific test fail. This caught, for example, a test that looked correct but could not actually detect a broken `updated_at` timestamp.

---

## A concrete bug found and fixed: argument-order swap in a type-safe language

During review of a pull request implementing AI-draft confirmation, the route handler called:

```ts
confirmAiDraft(userId, entryId, incidentId)
```

against a function declared as:

```ts
confirmAiDraft(entryId: number, incidentId: number, userId: number)
```

All three parameters are `number`, so **TypeScript's compiler accepted this with zero errors**, and the project's existing test suite passed — because the test's fixture setup reset the database between tests in a way that happened to make `userId`, `incidentId`, and `entryId` all equal to `1`, masking the swap entirely.

The bug was confirmed by deliberately driving the same SQL update with the IDs pushed apart (`user=41, incident=71, entry=901`) and showing the call updated zero rows instead of one — meaning every confirmation of an AI-drafted entry in production would have silently failed. The fix (correcting the argument order) was verified the same way before merge, and the test suite's blind spot (database rows that reset to the same ID every run) was flagged as a separate, reusable finding.

---

## Honest state summary

**Working end-to-end on `main`:** user registration/login, org-scoped incidents and timeline, real-time delivery over sockets, AI-draft generation via Gemini with a human confirm/reject gate, machine fingerprint publishing.

**Built, tested, but not wired to anything yet:** the relevance-scoring algorithm (no endpoint calls it; no collector feeds it real git data — the git-log collector itself doesn't exist).

**Schema exists, no code:** `diagnoses`, `resolutions`, `signatures_detected`.

**Interface defined, zero implementation:** the environment scanner/agent.

**Complete but unmerged:** client-side sign-in, registration, and route protection.
