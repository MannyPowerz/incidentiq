# 0001 - PostgreSQL as the single source of truth

## Context
IncidentIQ has multiple agents (one per developer machine) and multiple
browsers all observing and writing to the same shared war-room state, with
Socket.io delivering updates in real time. Something has to be the one
consistent reality every client converges on — and real-time delivery makes
it tempting to treat the live socket stream itself as that reality.

(Source: docs/architecture.md "The one rule that governs everything" and
"Why this shape"; the invariants in CLAUDE.md are the enforcement of this
decision.)

## Decision
PostgreSQL is the single source of truth — the permanent, official record.
The socket layer is a delivery wire only, never storage. Concretely, this
decision is enforced as three standing invariants:

- Write to PostgreSQL BEFORE emitting over Socket.io; if the DB write fails,
  nothing is broadcast. Never broadcast unstored data.
- Timelines sort by (incident_id, entry_id) — the database sequence is the
  order; socket arrival order is never trusted.
- On reconnect, clients refetch the gap from the DB
  (GET /incidents/:id/timeline?since=<lastSeenId>); sockets never replay
  missed history.

## Alternatives rejected & why
- **Peer-to-peer sync between agents** — considered and rejected in the
  system design: it introduces distributed-consistency problems (conflicting
  orders of events, no arbiter) for zero benefit at MVP scale.
- **Socket stream as truth (server relays, clients hold state)** — arrival
  order over a network is not trustworthy, and a client that disconnects has
  no authoritative place to recover missed history from. Broadcast-then-store
  variants can show clients data that was never persisted.

## Consequences
- Every write path pays a DB round-trip before anyone sees the update —
  latency is bounded by Postgres, not by the socket.
- Reconnection logic is simple and testable: rejoin rooms, refetch the gap
  by entry id, resume live. No replay buffers on the socket layer.
- The ordering and no-broadcast-on-failed-write invariants must be covered
  by explicit tests (per CLAUDE.md), since the whole design's correctness
  hangs on them.
- Downstream decisions inherit this shape: raw pg access (ADR 0002) and the
  schema conventions (ADR 0003) both assume the database is the arbiter of
  record and order.
