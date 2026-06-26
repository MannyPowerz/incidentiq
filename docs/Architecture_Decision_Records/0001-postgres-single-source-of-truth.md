# ADR 0001 — PostgreSQL as single source of truth

## Context

We need one authoritative data store for all incident timeline entries.
Multiple agents (local scanners) and multiple browsers all need to read
the same consistent reality. We are building an MVP with a 3-person team
on a semester deadline.

## Decision

PostgreSQL is the single source of truth. Every write goes to the database
before anything else happens. No broadcast, no notification, no UI update
occurs until the database write succeeds.

## Alternatives rejected

- **Peer-to-peer sync** — adds distributed consistency problems with no
  benefit at our scale. Two machines disagreeing on state is worse than
  one database being the authority.
- **Socket.io as storage** — sockets are a delivery mechanism, not a
  store. Data dies when the connection drops. This would make reconnection
  impossible to reason about.
- **Supabase** — considered for speed of setup, rejected because a
  hand-rolled Express + PostgreSQL backend is more defensible in a
  technical interview and gives us full control over the schema.

## Consequences

- Easier: reconnection is simple (refetch the gap from the DB),
  crash recovery is automatic, post-mortem integrity is guaranteed
- Harder: the database must be running for any write to succeed,
  no offline mode
- Debt accepted: no caching layer, no replication — single DB instance
  for the MVP
