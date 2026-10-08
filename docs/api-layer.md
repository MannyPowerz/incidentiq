# IncidentIOQ — Client API Layer

**Status:** proposed 2026-10-08. The contract for `client/src/api/`. Nothing under that path exists yet.
**Rule it enforces:** screens call these functions and nothing else. No `fetch` in a component, no import from `client/src/data/`. Every signature below is taken from the server's route handlers and type files as read on `main` @ `bd42ee2`; where a server shape is not pinned down, it says so.

## 1. Layout

```
client/src/api/
  types.ts         — client mirrors of server row types (§2). Hand-copied, with the source file named.
  client.ts        — re-exports apiFetch and ApiError from ../auth/api.ts; adds `json<T>(res)` unwrap helper.
  incidents.ts     — listIncidents, getIncident, createIncident, resolveIncident
  timeline.ts      — listTimeline, postTimelineEntry, confirmAiDraft, rejectAiDraft
  aiDraft.ts       — requestAiDraft
  fingerprints.ts  — listFingerprints (publishFingerprint documented, not exported for UI use)
  relevance.ts     — getRelevance                              ← FIXTURE-BACKED
  socket.ts        — connectSocket, joinRoom, leaveRoom, onEntry, onConfirm, onReject
  fixtures/
    relevance.ts   — the fixture, marked "// FIXTURE: replace when <endpoint> ships"
```

`client/src/auth/api.ts` is **not modified**. It already exports `apiFetch` (attaches the bearer token, refreshes once on `token_expired`) and `ApiError { status, code, message }`. Everything here builds on those two.

## 2. Types — what the server actually returns

Three facts that the current mock types get wrong, stated once here:

1. **Ids are numbers.** `incidents.id`, `timeline_entries.id`, `users.id` are `BIGSERIAL`, parsed to `number` by the server's pg type parser (`server/src/db/pool.ts`). The mocks use `"ROOM-0001"`.
2. **Dates are ISO strings on the wire.** Server types say `Date`, but JSON has no Date — the client receives `string` and formats it. Type them as `string`.
3. **Wrapped responses.** Most routes wrap: `{ incident }`, `{ incidents }`, `{ entries }`, `{ entry }`, `{ fingerprint }`, `{ fingerprints }`. Three return a **bare** entry: confirm, reject, and ai-draft (`res.status(200).json(confirmed)` in `timeline/routes/confirm.ts`; same pattern in `reject.ts` and `ai/routes/create.ts`). The unwrapping happens in this layer so screens never see the difference.

```ts
// types.ts — mirrors server/src/auth/types.ts, timeline/types.ts, fingerprints/types.ts, ai/types.ts

export type Severity = 'P1' | 'P2' | 'P3' | 'P4';
export type IncidentStatus = 'detected' | 'investigating' | 'mitigated' | 'resolved' | 'postmortem';
export type EntryType = 'observation' | 'action' | 'finding' | 'system' | 'ai_draft';
export type ClientPostableType = 'observation' | 'action' | 'finding';   // timeline/types.ts ClientPostableTypes

export interface Incident {
    id: number;
    title: string;
    status: IncidentStatus;
    org_id: number;
    severity: Severity;
    created_by: number | null;
    created_at: string;
    affected_system: string | null;
    resolved_at: string | null;
}

export interface TimelineEntry {
    id: number;
    incident_id: number;
    author_id: number | null;            // null for 'system' and unconfirmed 'ai_draft'
    type: EntryType;
    body: Record<string, unknown>;       // JSONB; shape varies by type, not pinned at Minimum
    locked: boolean;
    created_at: string;
}

export interface AiDraftBody {           // what body holds when type === 'ai_draft' (ai/types.ts aiDraftSchema)
    summary: string;
    why_it_matters: string;
    likely_fix: string;
}

export interface MachineFingerprint {
    id: number;
    user_id: number;
    project_id: string;
    node_version: string | null;
    os_arch: string | null;
    lockfile_hash: string | null;
    applied_migrations: string[] | null;
    updated_at: string;
}
export interface FingerprintWithPublisher extends MachineFingerprint {
    published_by: string;                // users.email, never null
}

export interface ApiErrorBody { error: string; message: string }
```

## 3. Functions

Every function: **throws `ApiError`** on a non-2xx response (status + the server's `error` code + a displayable `message`), **returns the unwrapped value** on success. Screens branch on `err.code`, never on status alone — the same rule `auth/api.ts` already follows for `token_expired`.

### incidents.ts — all REAL

| Function | Method / path | Returns | Server source | Error codes |
|---|---|---|---|---|
| `listIncidents(): Promise<Incident[]>` | `GET /incidents` | unwraps `{ incidents }` | `incidents/routes/list.ts` | 401 |
| `getIncident(id: number): Promise<Incident>` | `GET /incidents/:id` | unwraps `{ incident }` | `get.ts` | 404 `incident_not_found`, 401 |
| `createIncident(input: { title: string; severity: Severity; affected_system?: string }): Promise<Incident>` | `POST /incidents` → 201 | unwraps `{ incident }` | `create.ts`; body schema in `routes/index.ts` (`title` non-empty, `severity` enum, `affected_system` optional) | 400 `Bad Request`, 401 |
| `resolveIncident(id: number): Promise<Incident>` | `PATCH /incidents/:id` with `{ status: 'resolved' }` | unwraps `{ incident }` | `resolve.ts` — **only `'resolved'` is accepted today**; any other status → `400 unsupported_status` | 400, 404, 401 |

[uncertain] whether `GET /incidents` accepts an `?affected_system=` filter — ADR 0017 plans it for the agent; `list.ts` was not read for this doc. Not needed by any MVP screen.

### timeline.ts — all REAL

| Function | Method / path | Returns | Server source | Error codes |
|---|---|---|---|---|
| `listTimeline(incidentId: number, since?: number): Promise<TimelineEntry[]>` | `GET /incidents/:id/timeline[?since=<id>]` | unwraps `{ entries }`, **ordered by id ascending** (server does `ORDER BY id ASC`; `?since` returns only `id > since`) | `timeline/routes/get.ts`, `queries.ts` | 404 `incident_not_found`, 401 |
| `postTimelineEntry(incidentId: number, input: { type: ClientPostableType; body: Record<string, unknown> }): Promise<TimelineEntry>` | `POST /incidents/:id/timeline` → 201 | unwraps `{ entry }` | `create.ts`; `type` restricted to the three client-postable values (ADR 0014) | 400, 404, 401, 500 |
| `confirmAiDraft(incidentId: number, entryId: number): Promise<TimelineEntry>` | `PATCH /incidents/:id/timeline/:entry_id/confirmed` | **bare** entry | `confirm.ts` | 404 `entry_not_found`, 409 `not_ai_draft`, 409 `already_approved`, 401 |
| `rejectAiDraft(incidentId: number, entryId: number): Promise<TimelineEntry>` | `DELETE …/:entry_id/rejected` | **bare** deleted entry | `reject.ts` | 404, 409 `not_ai_draft`, 409 `already_approved`, 409 `entry_state_changed`, 401 |

### aiDraft.ts — REAL

| Function | Method / path | Returns | Server source | Error codes |
|---|---|---|---|---|
| `requestAiDraft(incidentId: number, input: { context: string; kind?: 'log' \| 'scanner' }): Promise<TimelineEntry>` | `POST /incidents/:id/ai-draft` → 201 | **bare** `ai_draft` entry, `author_id: null`, `body: AiDraftBody` | `ai/routes/create.ts`; schema in `ai/types.ts` (`context` non-empty, `kind` defaults `'log'`) | 400 `invalid_schema_structure`, 504 `upstream_error`, 500 `internal_error`, 404, 401 |

Needs `AI_MODEL_NAME` and a provider key set on the **server**; without them the server answers `504 upstream_error` (verified 2026-09-16 against a running server with no key). The screen shows "the AI provider did not answer" for 504 and does not retry automatically.

### fingerprints.ts — REAL

| Function | Method / path | Returns | Server source | Error codes |
|---|---|---|---|---|
| `listFingerprints(project: string): Promise<FingerprintWithPublisher[]>` | `GET /fingerprints?project=<id>` | unwraps `{ fingerprints }`, ordered by `user_id` | `fingerprints/routes/list.ts`; full contract in `docs/contracts.md` | 400 `project_required`, 401 |
| `publishFingerprint(input)` | `PUT /fingerprints` | `{ fingerprint }` | `publish.ts` | — |

`publishFingerprint` is documented so the layer is complete, but it is the **agent's** call (full-replace semantics, ADR 0010). No MVP screen calls it; it is not exported from the index.

### relevance.ts — FIXTURE

```ts
// client/src/api/relevance.ts
// FIXTURE: replace when GET /incidents/:id/timeline returns relevance per entry
//          (schedule.md "Relevance on page load" / "Wire relevance into entries").
export interface RelevanceLine {
    user_id: number;            // the most-relevant teammate for this entry
    reason: string;             // one plain-English sentence — the Minimum tier in build-plan.md
    score: number;              // 0..1, from TeammateScore.score; shown nowhere, kept for the swap
}
export async function getRelevance(incidentId: number, entryId: number): Promise<RelevanceLine | null> {
    return fixtureRelevance(incidentId, entryId);   // ← the ONLY line that changes when the endpoint ships
}
```

Shape is derived from `server/src/relevance/types.ts` (`TeammateScore` → one line via `ReasonFor`). `null` is the "every score is zero" case, which the UI must render as a sentence ("Nobody on the team has touched these files"), per the open question in that file. The server side is: scoring maths exists and is tested (`relevance.score.test.ts`), the collector does not exist, the reason generator does not exist, no route calls any of it. When a route does exist, the swap is the one function body above plus deleting `fixtures/relevance.ts`.

### socket.ts — REAL

Thin wrapper over `socket.io-client` (already in `client/package.json`, imported nowhere yet). Event names and payloads from `server/src/Socket/socketTypes-Schemas/socketTypes.ts` and the `join-room` handler as exercised by `server/tests/timeline.smoke.test.ts`.

```ts
connectSocket(token: string): Socket             // io(origin, { auth: { token }, reconnection: true }) — same JWT as HTTP
joinRoom(socket, incidentId: number, sinceId?: number): void   // emit 'join-room', { incidentId, sinceId }
leaveRoom(socket, incidentId: number): void      // [uncertain: no 'leave-room' event was seen; disconnect on unmount instead]
onEntry(socket, cb: (e: TimelineEntry) => void)   // 'new-message'
onConfirm(socket, cb: (e: TimelineEntry) => void) // 'confirm-draft'
onReject(socket, cb: (e: TimelineEntry) => void)  // 'reject-draft'
onSocketError(socket, cb: (err: { error: string }) => void)    // 'socket-error'
```

Rules the hook that uses this must keep: insert arriving entries **by id**, never append (ADR 0001 ordering); on reconnect re-`joinRoom` with the highest id held so the server's gap-fill covers the outage; dedupe by `id` because an entry you posted over HTTP also arrives over the socket.

Socket traffic goes through the Vite dev proxy (`/socket.io` with `ws: true`, `client/vite.config.ts`), so the origin is the page's own — pass no host.

## 4. Error → UI mapping

One table so every screen handles the same code the same way.

| `ApiError.code` | Where it comes from | What the UI does |
|---|---|---|
| `token_missing` / `token_invalid` | `requireAuth` | `apiFetch` does not retry these; the guard sends the user to sign-in |
| `token_expired` | `requireAuth` | handled inside `apiFetch` (silent refresh + one retry); screens never see it unless refresh also fails |
| `incident_not_found` | any `/incidents/:id/*` | ErrorState "This room doesn't exist or isn't yours" with a link to `/rooms` |
| `entry_not_found` | confirm / reject | Toast error, refetch the timeline |
| `not_ai_draft` / `already_approved` / `entry_state_changed` | confirm / reject | Toast "Someone else got there first", refetch — these are the TOCTOU races the server handles atomically |
| `unsupported_status` | PATCH incident | should be unreachable (UI only sends `resolved`); ErrorState if it happens |
| `upstream_error` (504) | ai-draft | ErrorState "The AI provider didn't answer. Try again." — no auto-retry |
| `invalid_schema_structure` (400) | ai-draft | ErrorState "The AI returned something unusable. Try again." |
| `project_required` | fingerprints | should be unreachable (UI always sends `?project=`) |
| `Bad Request` (400, ZodError in `message`) | `validateBody` | message is already a string by the time it leaves `auth/api.ts`'s pattern; show it inline on the form |
| network failure (fetch throws) | — | ErrorState "Can't reach the server" with retry |

## 5. Testing the layer

Same approach as `client/src/auth/api.test.ts`: mock `fetch`, assert the path, method, body, header, and the unwrap. One test per function for the happy path and one per distinct error code it maps. The fixture module gets a test that pins its shape to `RelevanceLine` so a drift in `server/src/relevance/types.ts` is noticed when someone updates the mirror. Mutation-verified per ADR 0015 before the suite is trusted.
