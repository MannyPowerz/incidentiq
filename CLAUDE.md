# CLAUDE.md — IncidentIQ (shared, checked in)

Restored 2026-10-08 from `e7194a4` (Jul 20), which sat on an unmerged branch and never reached `main`,
then updated to match the repo. The project is being renamed (docs/ui-roadmap.md, Item 9); names here change when that lands.

## What this is

A real-time war room that auto-detects silent dev-environment failures, lets a
human post them to a shared incident timeline, and surfaces each entry to the
teammate it's most relevant to. 2-person team (Manny, Anthony). Gabriella, who
built the original client UI, has left.

Current status and dates live in docs/schedule.md, not here.

## Stack

- Backend: Node.js + Express + TypeScript, PostgreSQL via raw `pg` and hand-rolled
  `.sql` migrations, no ORM/query builder — see docs/Architecture_Decision_Records/0002-raw-pg-no-orm.md
- Real-time: Socket.IO (rooms = incidents)
- Client: React 19 + Vite 8 + react-router-dom 7 + TypeScript. Plain CSS on design
  tokens, no UI library — see docs/design-system.md
- AI service: LangChain → Gemini (ADR 0009), output validated with Zod
  (summary / why_it_matters / likely_fix)
- Auth: bcrypt passwords (ADR 0004). A 15-minute JWT access token (payload shape: ADR 0005),
  held in client memory only, plus an httpOnly refresh cookie stored server-side as a hash.
  A dedicated agent credential is planned (ADR 0016).
- Relevance: server-side, local git via child_process (no GitHub API at Minimum)
- Agent (agent/): Node scanner on built-ins; signatures in a registry. Only the
  interfaces in agent/src/types.ts exist so far — see docs/agent-architecture.md
- Validation: Zod on every external + AI input

## Commands

Each package has its own `package.json`; run these from inside it.

- server: `npm run dev` (tsx watch), `npm test` (vitest), `npm run build` (tsc), `npm run migrate`
- client: `npm run dev` (Vite; proxies the API and `/socket.io`, target set by `SERVER_ORIGIN` in client/.env),
  `npm test` (vitest, no database needed), typecheck with `npx tsc -p tsconfig.app.json --noEmit`
- agent: `npm test`

Server tests need the throwaway Docker database — setup is in server/TESTING.md.

`npm run dev` and `npm run migrate` use `DATABASE_URL`, which is the real hosted database.
Prefix `NODE_ENV=test` to point either at the local Docker database instead.

`npm run lint` in client only checks `.js`: typescript-eslint does not support TypeScript 7 yet,
so `tsc` and the tests are the checks.

## Project invariants — do not violate (see docs/architecture.md)

- ALWAYS write to PostgreSQL BEFORE emitting over Socket.io. If the DB write
  fails, do not broadcast. Never broadcast unstored data.
- ALWAYS sort timelines by (incident_id, entry_id). NEVER sort by socket arrival time.
- The socket is delivery, not storage. On reconnect, refetch the gap from the DB
  (`join-room` with `sinceId` replays history, or `GET /incidents/:id/timeline?since=<lastSeenId>`);
  the socket never replays from memory.
- NEVER auto-post. The scanner detects and shows a private card; a human clicks post.
- Detection is deterministic (signatures). The AI only explains/drafts. Validate
  AI output against the Zod schema; retry once; fall back to signature.explain().
- New detection = a new signature object in the registry. NEVER modify the
  scanner loop to add one (open/closed).
- Every query that reads incident data is scoped by `org_id`. A user must never see another
  org's rows — `findIncidentById(id, orgId)` is the gate the other routes lean on.
- `ai_draft` and `system` entries have no human author. Clients may only post
  `observation`, `action`, `finding`; a human confirming an `ai_draft` is what sets its author (ADR 0014).
- The access token lives in memory only (client/src/auth/tokenStore.ts). NEVER localStorage.

## Client rules (see docs/design-system.md, docs/api-layer.md, docs/ui-roadmap.md)

- Screens call only the typed functions in `client/src/api/` — never `fetch` directly, never mock data.
  Ids are numbers and timestamps are ISO strings on the wire.
- Style only through the tokens in `client/src/styles/tokens.css` and the primitives in
  `client/src/components/ui/`. No raw hex or ad hoc sizes in component CSS.
- Replace in place: build the new screen, switch its route, delete the old files in the
  same change. Every route always has a working screen.
- An endpoint that is not built yet uses a typed fixture marked `// FIXTURE: replace when <endpoint> ships`.
- `client/src/auth/` is logic. A restyle must not change it.

## Scope (see docs/build-plan.md)

- Build to the plan's tiers. Do NOT build Complete/Post-MVP work while Minimum is
  incomplete. Flag scope creep instead of building it.
- Minimum demo = scanner catches VPN failure → human posts → stored → broadcast →
  teammate sees it ordered by relevance.

## Decision Gate

- Never pick an approach silently. At every fork, stop and ask:
  "I see a decision: [one sentence]. What's your instinct?"
- After I answer: confirm or correct my instinct, show max 3 options
  with one tradeoff each, then ask if I want to log it as an Architecture Decision Record.

## When to stop and ask

- Architecture forks
- Library or tool choices
- Data shape decisions
- Error handling approaches
- Scope boundary (Minimum vs Complete vs Post-MVP)
- Performance vs simplicity tradeoffs

## Options format

Max 3 options. For each: what it is + main advantage + main cost.
Never write code until I pick.

## Architecture Decision Records (ADRs)

Log a decision if any of these are true:

- A teammate could reasonably question it
- Hard to reverse later
- Affects how parts connect
- Locks in a library, pattern, or data shape

File location: docs/Architecture_Decision_Records/NNNN-\*.md (numbers continue from the highest in that folder)
Sections: Context / Decision / Alternatives rejected & why / Consequences
Draft → show me → wait for approval → commit.

## ADR discipline

When a decision in this session is architecturally significant (new dependency,
schema change, protocol/contract change, anything hard to reverse), you must:

1. Flag it in the moment: "This is ADR-worthy: [one-line reason]"
2. Offer to draft docs/Architecture_Decision_Records/NNNN-title.md
   using the existing ADR format
3. Wait for approval before writing the file — never commit an ADR I haven't read
   At session end, sweep the conversation for unlogged ADR-worthy decisions.

## Scope check (start of every feature)

Ask: "Which tier — Minimum, Complete, or Post-MVP?
Is the spine fully working before we build this?"
If spine isn't working, flag it and stop.

## End of session sweep

Ask: "What did we decide today that isn't logged yet?
Any of those need an Architecture Decision Record?"

## Commits and branches

- Atomic, one logical change each. Conventional Commits (feat:/fix:/refactor:/
  test:/docs:/chore:). Messages explain WHY.
- One branch per task, one PR per branch, merged before the next task's branch is cut from `main`.
  Prefix branches by type (`feat/`, `fix/`, `docs/`, `ui/`, `chore/`).
- Merge a multi-commit PR with a merge commit so each message survives. Squash only a
  single-concern PR: a squash takes the first commit's title, and once mislabeled five unrelated changes.
- Never force-push a shared branch. `--force-with-lease`, and only on your own rebased branch.

## Tests

- No implementation logic without accompanying unit/integration tests.
- Surface the test list and get author sign-off on what "correct" means before
  writing code or tests.
- Cover the invariants above with explicit tests (ordering by entry_id; no
  broadcast on DB-write failure).
- A new suite is not trusted until a deliberate mutation of the code it covers makes a test
  fail (ADR 0015).
- Server tests reset the database with `RESTART IDENTITY` after every test, so user, incident,
  and entry ids all start at 1 and coincide. A test that passes id-shaped arguments by position
  cannot catch a swap — this hid a real bug in `confirmAiDraft`. Offset the sequences with
  `setval` when order matters.

## Documentation

- Keep README.md and docs/architecture.md current. Capture the WHY, not just the what.

## Sources

- Link non-trivial framework/architecture choices to official docs. If none
  exists, say so and mark it inference. Never invent a citation.

## Secrets

- Never hardcode keys/passwords/tokens. Update .env.example when a new env var
  appears. .env is gitignored.
- Never put a real key in chat, a commit, or an editor settings file that syncs.

## Gotchas

- A paused or restoring hosted database returns the same `tenant or user not found` error as a
  wrong connection string. Wait and retry before touching the connection string.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:

- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
