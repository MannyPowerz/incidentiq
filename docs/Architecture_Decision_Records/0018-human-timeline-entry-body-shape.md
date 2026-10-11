# 0018 - The body shape of human timeline entries

> Numbered 0018 as the next free number across every branch. Status: **proposed, not decided.** It
> needs Manny and Anthony to choose between the options below. The "Proposed decision" section is a
> recommendation, not a record.

## Context

`timeline_entries.body` is JSONB. Only one type has a designed shape: an `ai_draft` body is
`{ summary, why_it_matters, likely_fix }`, validated by Zod (ADR 0006). For the three types a human can
post (`observation`, `action`, `finding`), the server says in `server/src/timeline/types.ts` that bodies
are "a generic object until their bodies are designed".

There are two write paths for human entries, and they validate the body differently:

| Path | Body validation | Broadcast |
|---|---|---|
| `POST /incidents/:id/timeline` (`timeline/routes/create.ts`) | `z.record(z.string(), z.unknown())`, any object | emits `new-message` after the insert |
| socket `sending-message` (`Socket/socketHandlers/emittingMessages.ts`) | must be `{ summary, why_it_matters, likely_fix }`, the AI-draft shape | emits `new-message` after the insert |

Both write to PostgreSQL before broadcasting, so both keep the invariant from ADR 0001. They disagree on
what a human entry contains. Under the socket path, someone typing "VPN drops on office wifi" would have to
fill a `why_it_matters` and a `likely_fix` field.

The client rebuilt in PR #42 needed some shape to ship, so it posts `{ text: string }` over HTTP. It reads
entries through a guard: `text` if it is a string, otherwise the raw JSON, so nothing is hidden. That shape
is currently a client convention, not a contract.

This matters now because of what reads the body next:

- **Live updates (UI Item 4).** If two clients post through different paths, a timeline can contain both
  shapes.
- **The AI service.** Human entries are likely future context for drafts (ADR 0008's expansion path), and a
  stable field to read is simpler than guessing.
- **Relevance.** Not today: `server/src/relevance/` scores teammates on files and systems, not entry text.

## Options

### A. `{ text }` for all three human types, and retire or align the socket write path

One free-text field. HTTP stays the only write path for human entries, which already broadcasts, so live
updates need no socket write at all. The socket's `sending-message` is either removed or changed to
validate `{ text }`.

- Advantage: matches how people actually write during an incident (one sentence, now). It matches what the
  client already sends, and it removes a second write path that can drift.
- Cost: no structure to query. "Every action someone took" is a filter on `type`, but nothing inside the
  body can be queried.

### B. A designed shape per type

For example, observation `{ text, source? }`, action `{ text, outcome? }`, finding `{ text, cause? }`,
each validated by its own Zod schema on both paths.

- Advantage: richer data for the AI context and for a later postmortem view.
- Cost: more form fields during an incident, which is exactly when people won't fill them in. It also adds
  schema work on both write paths, and it designs fields nobody has asked for yet.

### C. Reuse the AI-draft shape for human entries

This is what the socket path enforces today.

- Advantage: one shape for every entry, so the renderer has one branch.
- Cost: it forces a human to write a summary, an impact and a fix for a plain observation. It also blurs
  the line ADR 0014 drew between what the AI wrote and what a human vouched for, since the two would look
  identical.

## Proposed decision

**Option A**, pending agreement. Specifically:

1. Human entry bodies are `{ text: string }`, non-empty and trimmed. The HTTP route narrows its body schema
   from `z.record` to that, per type.
2. HTTP is the single write path for human entries. Clients use the socket to receive (`join-room`,
   `new-message`, `confirm-draft`, `reject-draft`), not to post.
3. The socket `sending-message` event is removed. Aligning it to `{ text }` instead is the fallback if
   Anthony has a reason to keep a socket write path (for example, latency, or the agent posting through
   it).

The reasoning in one line: the HTTP route already does write-then-broadcast, so a second write path adds a
second place for validation to drift and gives the client nothing it lacks.

## Alternatives rejected & why

Pending the decision. Options B and C above become this section once one option is chosen.

## Consequences (if A is accepted)

- The client keeps posting `{ text }`. Its raw-JSON fallback stays, for old rows written under the permissive
  schema.
- Server: `postTimelineEntrySchema` narrows the body. That is a breaking change for any caller sending
  other shapes. The only known caller is the client in PR #42.
- Server: `sending-message`, its schema, and its handler are deleted (or aligned), along with any tests. This
  is Anthony's code, so he should make or approve the change.
- UI Item 4 becomes receive-only, which is simpler, and has no body-shape conflict left to resolve.
- Moving to option B later is additive: new optional fields alongside `text` don't break readers.
