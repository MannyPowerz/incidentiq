# 0018 - The body shape of human timeline entries

> **Status: proposed.** Not accepted until Manny and Anthony both choose. Until then the Decision
> section is a recommendation, and the code is unchanged. Numbered 0018 as the next free number
> across every branch.

## Context

`timeline_entries.body` is JSONB. Only one type has a designed shape: an `ai_draft` body is
`{ summary, why_it_matters, likely_fix }`, validated by Zod (ADR 0006). For the three types a human
can post (`observation`, `action`, `finding`), `server/src/timeline/types.ts` says bodies are "a
generic object until their bodies are designed".

Two routes write human entries, and they validate the body differently:

| Route | Body validation | After the insert |
|---|---|---|
| `POST /incidents/:id/timeline` (`timeline/routes/create.ts`) | `z.record(z.string(), z.unknown())`: any object | emits `new-message` |
| socket `sending-message` (`Socket/socketHandlers/emittingMessages.ts`) | must be exactly `{ summary, why_it_matters, likely_fix }` | emits `new-message` |

Both insert into PostgreSQL before they broadcast, so the invariant from ADR 0001 holds on either
path. What they disagree on is content. Someone logging "VPN drops on office wifi" over the socket
would have to supply a `why_it_matters` and a `likely_fix`, because all three fields are required.

What is already true in the repo:

- **`{ text }` is already the de facto shape.** Every human entry posted by
  `server/tests/timeline.smoke.test.ts` is `{ text: '...' }`, and the rebuilt client's room page
  (not yet merged) does the same.
- **`sending-message` has one consumer.** Nothing in `client/src` or `agent/src` emits it. The only
  caller is the test "persists a message and broadcast it to the room" in
  `server/tests/socket.test.ts`, which sends the AI-draft fields.
- **Nothing reads human entry text.** `server/src/relevance/` scores teammates on files and
  systems, and no AI request field carries entry text (ADR 0008 lists incident metadata and a
  project-direction document, not entries).

The question is pressing because live updates (UI roadmap Item 4) are being built now. They only
receive, so they do not force this decision, but a second write path that disagrees with the first
is the kind of drift this ADR exists to stop before something depends on it.

## Decision

**Proposed: human entry bodies are `{ text: string }`, and HTTP is the only write path.**

1. `postTimelineEntrySchema` narrows its body from `z.record` to `{ text }`, a non-empty trimmed
   string. This matches what every existing caller already sends.
2. Clients write over HTTP and receive over the socket (`join-room`, `new-message`,
   `confirm-draft`, `reject-draft`). The HTTP route already writes and then broadcasts, so a
   second write path adds nothing a client lacks.
3. `sending-message` is removed, along with its schema and handler. Aligning it to `{ text }`
   instead is the fallback if there is a reason to keep a socket write path (see Consequences).

The reasoning in one line: people write one sentence during an incident, and one validated write
path cannot drift from itself.

## Alternatives rejected & why

- **A designed shape per type** (for example observation `{ text, source? }`, action
  `{ text, outcome? }`, finding `{ text, cause? }`). Rejected for now: it adds form fields during an
  incident, which is when people will not fill them, and nothing reads the fields it would add.
  Designing structure for a reader that does not exist is the speculative scope ADR 0007 defers.
  Moving to this later is additive: optional fields alongside `text` do not break readers.
- **Reuse the AI-draft shape for human entries** (what the socket enforces today). Rejected: it
  forces a human to write a summary, an impact and a fix for a plain observation, and it makes a
  human entry indistinguishable in shape from a machine one. ADR 0014 drew a deliberate line
  between what the AI wrote and what a human vouched for; sharing one body shape blurs it.
- **Leave both paths as they are.** Rejected: that is the current state, and it means the socket
  write path cannot be used for real text at all, while still looking supported. A path that
  works only for a shape nobody sends is worse than no path.

## Consequences

- The server's own tests already post `{ text }`, so narrowing the HTTP schema should not break
  them. Anything that posts another shape (none known: no agent code posts timeline entries) now
  gets a 400. Rows already stored under the permissive schema keep their old bodies, so readers
  must still tolerate a non-`{ text }` body. The client already does, rendering it as raw JSON.
- Removing `sending-message` deletes the one test that drives the socket's inbound path through
  the Zod middleware. `join-room` still passes through the same middleware, so the middleware stays
  covered, but the "persist then broadcast" proof for a socket write goes with the event. The HTTP
  route's equivalent proof is `timeline.smoke.test.ts`.
- The socket code is Anthony's, so he should make or approve the removal. If he wants to keep a
  socket write path (lower latency, or a future agent that posts over its connection), the
  alternative is to validate it against the same `{ text }` schema as HTTP and share one schema
  object between them, so they cannot diverge again.
- UI Item 4 stays receive-only either way, so it is not blocked on this.
- Revisit if something starts reading entry text (an AI draft that summarizes the timeline, or a
  postmortem view). That is the point at which structure per type earns its cost.
