# CLAUDE.md — IncidentIQ (shared, checked in)

## What this is

A real-time war room that auto-detects silent dev-environment failures, lets a
human post them to a shared incident timeline, and surfaces each entry to the
teammate it's most relevant to. 3-person team (Person 1 / 2 / 3).

## Stack

- Backend: Node.js + Express, PostgreSQL
- Real-time: Socket.io (rooms = incidents)
- Frontend: React + Vite
- AI service: LangChain, output validated with Zod (summary / why_it_matters / likely_fix)
- Auth: JWT
- Relevance: server-side, local git via child_process (no GitHub API at Minimum)
- Scanner: Node built-ins (TCP port checks, os.networkInterfaces(), file hashes);
  chokidar watches package-lock.json + migrations; signatures in a registry
- Validation: Zod on every external + AI input
- UNDECIDED — needs an Architecture Decision Record before use: migration tool / ORM (raw pg vs Prisma/Knex)

## Commands

- `npm run dev` — <fill in>
- `npm test` — <fill in>
- migrations — <fill in once the tool is chosen>

## Project invariants — do not violate (see docs/architecture.md)

- ALWAYS write to PostgreSQL BEFORE emitting over Socket.io. If the DB write
  fails, do not broadcast. Never broadcast unstored data.
- ALWAYS sort timelines by (incident_id, entry_id). NEVER sort by socket arrival time.
- The socket is delivery, not storage. On reconnect, refetch the gap from the DB
  (GET /incidents/:id/timeline?since=<lastSeenId>); sockets never replay.
- NEVER auto-post. The scanner detects and shows a private card; a human clicks post.
- Detection is deterministic (signatures). The AI only explains/drafts. Validate
  AI output against the Zod schema; retry once; fall back to signature.explain().
- New detection = a new signature object in the registry. NEVER modify the
  scanner loop to add one (open/closed).

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

File location: docs/Architecture_Decision_Records/000N-\*.md
Sections: Context / Decision / Alternatives rejected & why / Consequences
Draft → show me → wait for approval → commit.

## Scope check (start of every feature)

Ask: "Which tier — Minimum, Complete, or Post-MVP?
Is the spine fully working before we build this?"
If spine isn't working, flag it and stop.

## End of session sweep

Ask: "What did we decide today that isn't logged yet?
Any of those need an Architecture Decision Record?"

## Commits

- Atomic, one logical change each. Conventional Commits (feat:/fix:/refactor:/
  test:/docs:/chore:). Messages explain WHY.

## Tests

- No implementation logic without accompanying unit/integration tests.
- Surface the test list and get author sign-off on what "correct" means before
  writing code or tests.
- Cover the invariants above with explicit tests (ordering by entry_id; no
  broadcast on DB-write failure).

## Documentation

- Keep README.md and docs/architecture.md current. Capture the WHY, not just the what.

## Sources

- Link non-trivial framework/architecture choices to official docs. If none
  exists, say so and mark it inference. Never invent a citation.

## Secrets

- Never hardcode keys/passwords/tokens. Update .env.example when a new env var
  appears. .env is gitignored.
