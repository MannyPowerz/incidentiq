# IncidentIQ Local Agent — Architecture

**Status:** design, nothing built
**Scope:** Minimum tier per `build-plan.md` — one signature, the human gate, fingerprint publish
**Owners:** Anthony (scanner, signature, CLI, HTTP client) · Manny (auth ADR, review)
**Companion docs:** `architecture.md` (the system), `integration-plan.md` (how this plugs in), `schedule.md` (when)

---

## 1. What it is and the one rule

The agent is component 1 of 4 in `architecture.md`. It runs on each developer's
machine, reads that machine's environment, runs signatures against what it
finds, and shows the developer a private card when something fires.

**It detects. It never decides what to share.** Nothing leaves the machine until
a human says yes. This is the line from `architecture.md` that governs the whole
design — *"The agent detects. The human decides. The database remembers. The
socket delivers."* — and every module below is shaped by it.

It is also **step 1 of the Minimum demo definition** (`build-plan.md` line 82):
*"A developer's scanner catches a VPN failure."* The demo opens with this.
Without it there is no demo.

## 2. Why it was missed, briefly

`build-plan.md` line 42 assigned it to Phase 2, "Person 3." Every ADR written
(0001–0015) is server-side. Both three-way splits were server-side. It had no
branch, no contract, no ADR, and was never on anyone's list. Nobody was late on
it because nobody had it.

## 3. Scope: Minimum only

`build-plan.md`'s tiers for the scanner:

| Tier | Minimum | Complete | Post-MVP |
|---|---|---|---|
| Tier 1 | **Port responsiveness check + VPN demo scenario** | all three checks | expanded list |
| Tier 2 | **Fingerprint publishing + Node version diff** | lockfile + migration drift | git collision |

**Built for the MVP:**
- One signature: `VPN_LOOPBACK`
- The private card and the human gate (CLI)
- Fingerprint collection and publish via the existing `PUT /fingerprints`
- Posting an approved detection to the server

**Explicitly deferred, with the reason:**
- `ENV_VAR_MISSING`, `PORT_COLLISION`, all three Tier 2 signatures — above
  Minimum. The signature interface makes each one an additive file later.
- chokidar file watching — the Minimum scans on an interval; watching is a
  refinement of *when* to scan, not *what*.
- Writing to `signatures_detected` — step 11 (archive mining) is not in the
  demo definition, and the server has no endpoint for it yet.
- Picking an existing incident to post into — the Minimum creates a new one.
- **A browser interface for the agent.** This is CLI-only, full stop — §6.5's
  private card is a `readline` prompt in a terminal, not a page. An early
  Notion board grouped this work as "Scanner + React," which read as though a
  browser view was assumed; it wasn't designed and isn't built. The terminal
  card is arguably the stronger demo beat regardless — detection happening
  before a browser is even involved is the story `architecture.md`'s "agent
  detects, human decides" is telling. Revisit if client-side work finishes
  early, or once `signatures_detected` is actually being written to — a
  read-only page listing recent rows is the natural next slice, not a
  rewrite of anything here.

`build-plan.md` line 71 is the rule that makes this defensible: *"If any feature
is at risk of missing Minimum, it borrows time from a feature sitting above
Minimum — never from the spine."*

## 4. Where it lives

```
incidentiq/
├── server/       existing
├── client/       existing
└── agent/        NEW — sibling, own package.json, own tsconfig
    ├── package.json
    ├── tsconfig.json
    ├── .env.example
    └── src/
        ├── index.ts          entry: load config → login → loop
        ├── config.ts         env + defaults, validated once at start
        ├── types.ts          EnvSnapshot, Signature, Detection — the contract
        ├── scanner.ts        collect(): builds one EnvSnapshot
        ├── engine.ts         runs every registered signature against a snapshot
        ├── signatures/
        │   ├── index.ts      the registry — an array of Signature objects
        │   └── vpnLoopback.ts
        ├── card.ts           the private card + [y/N] prompt
        ├── client.ts         HTTP: login, refresh, create incident, post draft, publish fingerprint
        └── fingerprint.ts    builds the PUT /fingerprints body from a snapshot
```

**Own package, not inside `server/`.** It runs on a different machine, as a
different process, with its own dependencies. It talks to the server over HTTP
only. No shared code at runtime — the two or three request-body shapes it needs
are small enough to duplicate, and `docs/contracts.md` is the spec both sides
build against.

**No new runtime dependencies for the Minimum.** Everything is Node built-ins:
`net`, `os`, `crypto`, `fs`, `readline`, `child_process`. `tsx` for running TS,
`vitest` for tests. chokidar arrives when watching does.

## 5. The contract — `agent/src/types.ts`

This is the file to write first. It is the seam that lets the scanner, the
signature, and the CLI be built in parallel, exactly as `relevance/types.ts`
and `ai/types.ts` did for their splits.

```ts
/** What one scan of the machine produced. Every signature reads from this. */
export interface EnvSnapshot {
    takenAt: Date;
    nodeVersion: string;          // process.version
    osArch: string;               // `${os.platform()}-${os.arch()}`
    lockfileHash: string | null;  // sha256 of package-lock.json, null if absent
    appliedMigrations: string[];  // filenames in the migrations dir
    ports: PortProbe[];           // one per configured port
    tunnelInterfaces: string[];   // names of utun*/tun* interfaces present
}

export interface PortProbe {
    port: number;
    bound: boolean;       // something is listening (EADDRINUSE when we try to bind)
    responsive: boolean;  // a TCP connect succeeded AND bytes came back within the timeout
    latencyMs: number | null;
}

/** What a signature says when it fires. */
export interface Detection {
    signatureId: string;          // matches Signature.id, e.g. 'VPN_LOOPBACK'
    tier: 1 | 2;
    severity: 'info' | 'warn' | 'critical';
    title: string;                // one line, becomes the incident title
    explanation: string;          // the card body and the AI draft context
    affectedSystem: string;       // must be a key resolveFilePaths knows, e.g. 'auth'
    evidence: Record<string, unknown>;  // the raw facts, for the payload
}

/** One self-contained check. The engine is a loop over an array of these. */
export interface Signature {
    id: string;
    tier: 1 | 2;
    severity: 'info' | 'warn' | 'critical';
    /** Pure. Reads the snapshot, returns a Detection or null. No I/O here. */
    evaluate(snapshot: EnvSnapshot): Detection | null;
}
```

**Deliberate departure from `architecture.md`'s sketch.** The doc shows
`collect()` on each signature. That is not how this is built: **one scanner
collects, every signature evaluates.** Collection is I/O and should happen once
per cycle, not once per signature. Splitting it makes every `evaluate` a pure
function on a plain object, which is what makes it testable with a fixture and
no network — the same reasoning that put `now` as a parameter in `decay.ts`.

`peers?` from the sketch is also dropped for the Minimum. It exists for Tier 2
signatures, which compare against teammates' fingerprints. `VPN_LOOPBACK` is
Tier 1 and needs no peers. Add it as an optional second argument when the first
Tier 2 signature lands — additive, no rewrite.

## 6. Module by module

### 6.1 `config.ts` — validated once at start

```
AGENT_API_URL          http://localhost:3000
AGENT_EMAIL            the developer's incidentiq login
AGENT_PASSWORD         see §8 for why this is acceptable at Minimum
AGENT_PROJECT_ID       string, e.g. 'incidentiq' — the fingerprint's project_id
AGENT_PROJECT_ROOT     absolute path to the repo being watched
AGENT_PORTS            comma list, default '5173,3000'
AGENT_SCAN_INTERVAL_S  default 30
AGENT_PROBE_TIMEOUT_MS default 2000
```

Missing required values fail at startup with the variable named, same as
`globalSetup.ts` does for `TEST_DATABASE_URL`. An agent that boots and then
fails on its first scan is worse than one that refuses to boot.

### 6.2 `scanner.ts` — build one `EnvSnapshot`

One exported function, `collect(config): Promise<EnvSnapshot>`. Everything in
it is Node built-ins:

| field | how |
|---|---|
| `nodeVersion` | `process.version` |
| `osArch` | `os.platform()` + `os.arch()` |
| `lockfileHash` | `createHash('sha256')` over `<root>/package-lock.json`; `null` if the file is absent |
| `appliedMigrations` | `readdir(<root>/server/db/migrations)` filtered to `.sql`, sorted |
| `tunnelInterfaces` | `Object.keys(os.networkInterfaces())` filtered to `/^(utun|tun|tap|wg)/` |
| `ports` | one `probePort()` per configured port, run concurrently |

**`probePort()` is the only non-trivial piece.** "Bound but not responding" is
two separate facts:

1. **Bound?** Try `net.createServer().listen(port)`. `EADDRINUSE` means yes.
   Close it immediately either way. This is the only reliable cross-platform
   way to ask "is anything on this port" without parsing `lsof`.
2. **Responsive?** `net.connect(port)`, write a single `\r\n`, and wait up to
   `AGENT_PROBE_TIMEOUT_MS` for **any bytes back.** Connect success alone is not
   enough — a socket that accepts and never writes is exactly the failure the
   VPN scenario produces. Bytes-or-timeout is the test.

The scanner never throws on a single failed probe. A port that cannot be
checked is recorded as `bound: false, responsive: false, latencyMs: null` and
the scan continues. One flaky port must not stop the cycle.

### 6.3 `engine.ts` — the loop

```ts
export function runSignatures(snapshot: EnvSnapshot, registry: Signature[]): Detection[]
```

Map over the registry, call `evaluate`, keep the non-nulls. Ten lines. The
whole point of the signature shape is that this file **never changes** when a
signature is added.

### 6.4 `signatures/vpnLoopback.ts` — the one signature

**What it detects:** a port that something is listening on, that does not
answer. The VPN story is that a tunnel interface has captured loopback routing
so the dev server is bound but unreachable.

```ts
evaluate(snapshot) {
    const dead = snapshot.ports.filter((p) => p.bound && !p.responsive);
    if (dead.length === 0) return null;

    const tunnel = snapshot.tunnelInterfaces.length > 0;
    return {
        signatureId: 'VPN_LOOPBACK',
        tier: 1,
        severity: tunnel ? 'critical' : 'warn',
        title: `Port ${dead[0].port} is bound but not responding`,
        explanation: tunnel
            ? `... and a tunnel interface (${snapshot.tunnelInterfaces.join(', ')}) is active. A VPN is likely capturing loopback traffic.`
            : `... no tunnel interface detected; could be a hung process.`,
        affectedSystem: 'sockets',   // or per-port mapping, see §10
        evidence: { ports: dead, tunnelInterfaces: snapshot.tunnelInterfaces }
    };
}
```

**A design call worth stating:** the tunnel interface **raises severity, it does
not gate the detection.** `build-plan.md` Minimum is "port responsiveness check
+ VPN demo scenario" — the port check is the mechanism, the VPN is the story
told about it. Making the tunnel a hard requirement would mean the demo cannot
run without a real VPN connected, and it would miss the identical symptom from
a hung process. Bound-and-dead fires; tunnel-present makes it critical.

**Pure function.** No I/O, takes a snapshot, returns a detection or null. Tested
with three fixtures: nothing dead → null; dead port, no tunnel → warn; dead port
plus tunnel → critical. Mutation-verified per ADR 0015.

### 6.5 `card.ts` — the private card and the gate

```
┌─ IncidentIQ ── VPN_LOOPBACK ── critical ────────────────────────┐
│                                                                   │
│  Port 5173 is bound but not responding, and a tunnel interface   │
│  (utun3) is active. A VPN is likely capturing loopback traffic.  │
│                                                                   │
│  Nothing has been sent. Post this to the war room?  [y/N]        │
└───────────────────────────────────────────────────────────────────┘
```

`readline` from the standard library. Default is **No** — pressing Enter posts
nothing. This is the human gate from data-flow step 3–4, and the default
direction is the architecture's rule made concrete.

**Debounce.** After a card is answered — either way — the same `signatureId` is
suppressed for `AGENT_SCAN_INTERVAL_S × 10` (five minutes at defaults). A dev
who said No should not be asked again thirty seconds later. In-memory map of
`signatureId → suppressedUntil`.

### 6.6 `fingerprint.ts` — the publish body

Maps an `EnvSnapshot` to the shape `PUT /fingerprints` already accepts
(`contracts.md`):

```ts
{
    project_id: config.projectId,
    node_version: snapshot.nodeVersion,
    os_arch: snapshot.osArch,
    lockfile_hash: snapshot.lockfileHash,
    applied_migrations: snapshot.appliedMigrations
}
```

Published **once at startup and again whenever the hash of this body changes.**
Not every cycle — the endpoint is a full-replace upsert and republishing an
identical snapshot is a write for nothing. This is Tier 2 Minimum ("fingerprint
publishing") and it needs no new server code.

### 6.7 `client.ts` — HTTP, and the one decision inside it

Five calls, all against endpoints that exist or are in open PRs:

| call | endpoint | status |
|---|---|---|
| `login()` | `POST /auth/login` | on `main` |
| `refresh()` | `POST /auth/refresh` | on `main` |
| `createIncident(detection)` | `POST /incidents` | on `main` |
| `requestDraft(incidentId, detection)` | `POST /incidents/:id/draft` | **Anthony's delivery PR — see integration-plan §4** |
| `publishFingerprint(body)` | `PUT /fingerprints` | on `main` |

Native `fetch`. The refresh cookie is `httpOnly` — irrelevant to a Node client,
which reads `Set-Cookie` off the login response and sends it back as a `Cookie`
header on `/auth/refresh`. About ten lines to parse. `sameSite: 'strict'` is
enforced by browsers, not servers, so it does not affect the agent.

**On `401 token_expired`** — the specific code `requireAuth` returns for this —
call `refresh()` once and retry. Any other 401 means re-login. This is exactly
why `middleware.ts` distinguishes `token_expired` from `token_invalid`.

### 6.8 `index.ts` — the run loop

```
load config, fail fast on anything missing
login → hold accessToken + refresh cookie in memory
publish fingerprint
loop every AGENT_SCAN_INTERVAL_S:
    snapshot = collect()
    if fingerprint body changed → publish
    detections = runSignatures(snapshot, registry)
    for each detection not suppressed:
        answer = await card(detection)
        suppress(detection.signatureId)
        if answer === 'y':
            incident = createIncident(detection)
            requestDraft(incident.id, detection)
            print "posted as incident #<id>"
```

Run with `npx tsx agent/src/index.ts`. Ctrl-C exits. No daemonization, no PID
files, no service install — a terminal the developer leaves open is the
Minimum.

## 7. Data flow, end to end

Maps to `architecture.md` steps 1–5, then hands off:

```
1. scanner.collect()            → EnvSnapshot
2. engine.runSignatures()       → Detection[]           VPN_LOOPBACK fires
3. card.show(detection)         → private, on-screen    NOTHING has left the machine
4. developer presses y          → the human gate
5. client.createIncident()      → POST /incidents        server: row in `incidents`
   client.requestDraft()        → POST /incidents/:id/draft
                                                          server: draftFromContext(explanation)
6.                                                        server: ai_draft row, author_id NULL  (ADR 0014)
7.                                                        server: written to Postgres
8.                                                        server: scoreTeammates(...)           integration-plan §5
9.                                                        server: io.to(room).emit(...)
10.                                                       browsers: each sorts by own score
```

The agent's responsibility ends at step 5. Steps 6–10 are the server and the
client, and they are specified in `integration-plan.md`.

## 8. Authentication — the open decision

A headless process needs a JWT. Nothing in any existing document says how it
gets one. **This needs ADR 0016 before `client.ts` is written**, and Manny
owns it since he owns auth.

The options, so the ADR has something to choose between:

| option | server change | secret on disk | verdict for Minimum |
|---|---|---|---|
| A. Paste an access token | none | yes, 15-min lifetime | **no** — expires before the second scan |
| B. Paste the refresh token | none | yes, 30-day | works, but extracting an httpOnly cookie by hand is hostile UX |
| **C. Email + password in agent config** | **none** | **yes** | **recommended** — zero server work, same threat model as `.env` holding `DATABASE_URL` |
| D. Dedicated agent token / API key | new endpoint + table or column | yes, revocable | the right long-term answer; not Minimum |

**Recommend C, record D as the upgrade path.** The agent runs on the
developer's own machine reading the developer's own credentials. That is the
same trust boundary as every `.env` file in this repo. The ADR should say so
plainly, name D as where this goes, and name the trigger: the first time
someone wants to revoke an agent without changing their password.

## 9. Error handling

| failure | behaviour |
|---|---|
| Missing config | exit non-zero at startup, variable named |
| Server unreachable at login | exit non-zero, URL named — an agent with no server is useless |
| Server unreachable mid-loop | log once, keep scanning, retry on next cycle; do not exit |
| One port probe throws | record it as unprobed, continue the scan |
| `401 token_expired` | refresh once, retry once |
| `401` anything else | re-login once; if that fails, exit |
| `POST` after `y` fails | print the error, do not suppress — the dev should be able to retry |
| Signature `evaluate` throws | catch per-signature, log, continue — one broken check cannot kill the loop |

The pattern is the same as the server's: fail fast on things that are wrong at
boot, fail soft on things that are wrong at runtime.

## 10. Open decisions, ranked

1. **Auth (§8).** Blocks `client.ts`. ADR 0016. Manny.
2. **`affectedSystem` per port.** The detection carries a system name that
   `resolveFilePaths` turns into directories for relevance. A port → system
   map (`5173 → 'client'`, `3000 → 'server'`?) is tiny but the keys must match
   `SYSTEM_TO_PATHS` in `relevance/systemPaths.ts` or relevance scores nobody.
   Decide the vocabulary once, in one place, and both sides read it.
3. **Does `POST /incidents/:id/draft` exist and what does it take?** Anthony's
   delivery half. See integration-plan §4. If it lands with a different shape,
   `client.ts` follows it — the agent is the caller, not the owner.
4. **Scan interval.** 30s default. Fine for the demo. Irrelevant until
   watching lands.

## 11. Testing

Per ADR 0015: examples, real I/O where the value is, verified by mutation.

| module | test type | notes |
|---|---|---|
| `vpnLoopback.evaluate` | pure, fixtures | three cases (§6.4). Mutate the `bound && !responsive` to `||` — must fail |
| `engine.runSignatures` | pure | a registry of two fakes, one fires, one doesn't |
| `scanner.probePort` | **real sockets** | spin up a `net.Server` that accepts and never writes → `bound: true, responsive: false`. Spin up one that echoes → `responsive: true`. Nothing listening → `bound: false`. This is the one place a mock would hide the exact bug the signature exists to catch |
| `fingerprint.toBody` | pure | snapshot in, body out, `null` lockfile stays `null` |
| `client.*` | mocked `fetch` | the `token_expired` → refresh → retry path is the case worth pinning |
| `card` | not unit-tested | it's `readline`; the run loop's `y`/`N` branching is covered by testing the loop with a stubbed card |

## 12. The demo trigger

The demo has to reproduce "bound but not responding" on command. A script,
`agent/scripts/demo-dead-port.ts`:

```ts
// Binds the port and accepts connections but never writes a byte.
// That is exactly the symptom VPN_LOOPBACK detects.
net.createServer((socket) => { /* hold it open, say nothing */ }).listen(5173);
```

Run it, start the agent, the card appears within one scan interval. Kill it,
the next scan is clean. No VPN required — the tunnel interface is a severity
boost, not a gate (§6.4). If a real VPN is connected during the demo, the card
says `critical` and names the interface, which is the better story; if not, it
says `warn` and still fires.

## 13. What "done" means for the MVP

- [ ] `npx tsx agent/src/index.ts` boots, logs in, publishes a fingerprint
- [ ] `GET /fingerprints?project=incidentiq` returns that machine's row
- [ ] Running the demo trigger produces a card within one scan interval
- [ ] Pressing Enter (default No) posts nothing, and the card does not reappear for five minutes
- [ ] Pressing `y` creates an incident and an `ai_draft` entry appears in the war room UI
- [ ] Killing the trigger clears the detection on the next scan
- [ ] All tests pass; the `evaluate` and `probePort` mutations each fail exactly their case
- [ ] `docs/contracts.md` has an "Agent" section documenting the calls it makes
