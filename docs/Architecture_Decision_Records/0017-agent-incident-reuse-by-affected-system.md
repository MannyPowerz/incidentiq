# 0017 - Agent Incident Reuse by Affected System

## Context

`insertIncident` has no lookup before it writes — every approved detection
the agent posts creates a brand new incident row, with no check for whether
one already exists for the same problem. If `VPN_LOOPBACK` fires three times
because the same VPN connection stays up across three scan intervals, three
separate incidents land in the war room, each with its own single entry,
rather than one incident accumulating three touches on the same underlying
problem.

This was not caught by the demo runbook because the runbook only exercises
the flow once. It would have surfaced during dogfooding (`schedule.md`,
"Dogfood week") — a room filling with duplicate incidents for one ongoing
issue is the kind of thing that looks broken in front of an evaluator, and
worse, it fragments the relevance signal: three thin incidents give the
scorer less to work with than one incident with real history.

## Decision

**Agent-Side Incident Reuse by Affected System.** Before creating an
incident, the agent checks whether an open incident already exists for the
same `affected_system` in its org, and posts into that one instead of
creating a new row.

- **The match key is `affected_system` alone**, not the signature that
  fired. `signatures_detected` is not written to yet (confirmed unused in
  `technical-audit.md` §4.5) — there is no `signature_id` on an incident to
  match against without also building that write path, which is more scope
  than this decision is trying to add. Matching on `affected_system` is
  coarser — two distinct problems on the same system would look like one to
  this logic — and that imprecision is accepted for Minimum.
- **"Open" means not `resolved` or `postmortem`.** A resolved incident is
  closed history; a new detection on that system is a new problem, not a
  continuation, and should open a fresh incident.
- **The check lives in the agent's own HTTP client, not inside
  `POST /incidents`.** `findIncidentsByOrg` gains an optional
  `affectedSystem` filter — additive, the same pattern `?since=` already
  established on `GET /incidents/:id/timeline`. The agent calls
  `GET /incidents?affected_system=X`, takes the most recent open result if
  one exists, and calls `POST /incidents/:id/draft` on it; otherwise it
  calls `POST /incidents` as it does today.
- **A human creating an incident through the UI is unaffected.**
  `POST /incidents` itself does not change. Reuse is something the agent
  decides for itself, because a human clicking "new incident" has already
  made the decision that this is a new incident — silently merging that into
  an existing one would be a surprising thing for software to do on a
  person's behalf.

## Alternatives rejected & why

- **No change — always create new** — rejected: this is the status quo, and
  it is the thing making the room fill with duplicates for one ongoing
  problem, fragmenting both the war room's readability and the relevance
  signal across artificially separate incidents.
- **Reuse logic inside `POST /incidents` for every caller** — rejected: it
  would apply the same silent-merge behavior to humans using the UI, who did
  not ask for it and would find an existing incident opening under them
  surprising rather than helpful. The reuse decision belongs with the caller
  who benefits from it, not baked into a shared endpoint every caller pays
  for.
- **Match by `signature_id` instead of `affected_system`** — the more
  precise version, and the real upgrade path once `signatures_detected` is
  actually populated. Rejected for now because building that write path is
  separate scope this decision does not need in order to close the gap that
  actually exists today.
- **A dedicated `find-or-create` server endpoint** — considered. This is
  where the logic would move if more than one caller ever needed
  "intelligently reuse or create" behavior. Today the agent is the only
  caller with this need, so adding an endpoint whose only consumer is the
  agent is complexity ahead of a second use case for it.

## Consequences

- `findIncidentsByOrg` needs one additive optional filter parameter and a
  small `WHERE affected_system = $n` clause. `GET /incidents` gains an
  optional `?affected_system=` query param. Neither changes any existing
  caller's behavior when the param is absent.
- The agent's HTTP client (`agent-architecture.md` §6.7) needs a check-then-
  branch step before its create call: list, inspect, then either draft
  against an existing incident or create a new one.
- The coarse match can be wrong in one direction: two unrelated problems on
  the same system within the same open window read as one incident. Revisit
  once `signatures_detected` is written to and a `signature_id` match becomes
  possible without new scope.
- Scheduled separately from this ADR, in `schedule.md`, as real query and
  agent-side logic — a small task, not folded into today's decision record.
