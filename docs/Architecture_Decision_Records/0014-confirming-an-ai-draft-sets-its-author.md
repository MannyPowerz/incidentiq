# 0014 - Confirming an AI draft sets its author, and adds no columns

> Numbered 0014 as the next free number across every branch, not just this one.
> 0006 through 0009 live on `feat/ai-brain` and 0011 through 0013 on
> `feat/relevance-scoring`; none have merged. A gap is harmless, a duplicate is
> not.

## Context

Migration 0002 makes `timeline_entries.author_id` nullable and says why:

```sql
author_id BIGINT,  -- nullable on purpose: 'system' and 'ai_draft' entries have no human author
```

That comment describes an invariant nothing enforces. `postTimelineEntrySchema`
accepts `'ai_draft'` and `'system'` from any authenticated client, and
`handleCreateTimelineEntry` assigns `Number(req.user!.sub)` to `author_id`
unconditionally, with no branch on `type`. A client can POST an `ai_draft`
today and get a row that is simultaneously typed as machine-written and stamped
with a human author. The schema comment has been false since the route was
written.

Anthony surfaced this while building the AI service, framed as a query problem:
once the AI path writes entries through the same handler, any count of "entries
a person authored" silently includes machine-written ones. He proposed
`confirmed_by` and `confirmed_at` columns, distinguishing who wrote the text
from who vouched for it, and argued it matches `architecture.md` line 9,
"The agent detects. The human decides."

The distinction he named is real. The columns turned out not to be the way to
record it, and the argument that settled it came from his own framing of what a
reader should see.

## Decision

### The bug: `'ai_draft'` and `'system'` leave the client-facing enum

`postTimelineEntrySchema` narrows to the three human types. The AI and system
paths insert through their own call, not through the human route.

This is prevention rather than correction. The alternative was branching inside
the handler, computing `author_id` as null when the type is machine-written.
That fixes the same rows and leaves the illegal state expressible: the next
handler someone writes has to remember the same branch. Removing the types from
the schema makes the bad row unreachable through this route at all.

### Confirming sets `author_id`. No new columns

An AI draft is written with `author_id` null. When a human confirms it, that
column is set to them. Two states on columns that already exist:

| state | row | reads as |
|---|---|---|
| unconfirmed | `type='ai_draft'`, `author_id IS NULL` | the AI wrote this, nobody has vouched for it |
| confirmed | `type='ai_draft'`, `author_id = 12` | the AI wrote this, and Manny stands behind it |

**The framing that decided this** was Anthony's own: six months from now, someone
scrolls the timeline and finds an AI-drafted entry. Should it read "the AI wrote
it" or "Manny posted it and the AI wrote it"?

The answer is that both are wanted, and *which one it reads is the data*. If it
always read the second, there would be no confirm step to speak of. A dedicated
`confirmed_by` column expresses the same two states with an extra column that
duplicates `author_id`'s value, since the same person fills both.

### `type` never changes on confirming

It stays `'ai_draft'` permanently, because the model did write the text. This is
the single rule holding up the "and the AI wrote it" half of that sentence. If
confirming flipped the type to `'finding'`, the entry would read as though the
human wrote it, which is false, and the provenance would be gone with no way to
recover it.

### Confirm or reject. No editing in between

A human who wants to change the draft rejects it and writes their own entry as a
normal `finding`.

This is forced by the two-state model rather than chosen freely, and it is worth
being honest about that. An edited draft is neither state: keeping
`type='ai_draft'` claims the model wrote text the human rewrote, and flipping
the type claims the human wrote text the model drafted. Both are false, and
there is no third state without the column this ADR declines to add.

Refusing the edit is the cheaper resolution and reads truer to "the human
decides" anyway. Deciding is accepting or rejecting. Rewriting is authoring, and
authoring already has a path.

### "Which entries did a person write" filters on `type`, not `author_id`

`WHERE type NOT IN ('ai_draft','system')`. This is the query Anthony's original
concern was about, and it works without any schema change, because `type`
already carries the origin of the text. `author_id IS NOT NULL` no longer
answers that question, and after this ADR it answers a different one: who is
accountable for the entry, whoever produced the words.

## Alternatives rejected & why

- **`confirmed_by` plus `confirmed_at`** — rejected as unnecessary rather than
  wrong, and it is the design to return to if either of two things becomes true:
  something needs to know *when* an entry was confirmed, or the confirmer and
  the author can genuinely be different people. Neither is true today. Against
  it now: a migration on `timeline_entries`, which is core, merged, and depended
  on by all three people's work, proposed during end-of-MVP integration. It also
  brings a `CHECK ((confirmed_by IS NULL) = (confirmed_at IS NULL))` to stop half
  a confirmation being storable, and the confirm endpoint would write two
  columns where one carries the whole meaning. Deferring costs nothing: the
  migration is no harder in three months than today.
- **Branching on `type` inside the handler** — rejected in favour of narrowing
  the schema. Same rows fixed, but the illegal state stays expressible and the
  guard has to be repeated by every future writer.
- **Confirming creates a second entry** — rejected: the draft would stay
  authorless and the human's acceptance would insert a new row naming them. It
  preserves everything and needs no schema change, but it puts two rows in the
  timeline for one thought, and the timeline is the product. It also makes
  "has this been confirmed" a join instead of a null check.
- **Flipping `type` to `'finding'` on confirm** — rejected: destroys the AI
  provenance, which is exactly the half of the sentence this design exists to
  keep true.
- **Allowing edits and leaving `type='ai_draft'`** — rejected: the entry then
  claims machine authorship of text a human rewrote. Quieter than the previous
  option and false in the same way.
- **A `confirmed BOOLEAN` flag** — rejected: records that someone confirmed
  without recording who, which is strictly less than `author_id` already gives,
  and adds a column that can disagree with `author_id`.

## Consequences

- **Deleting a user silently un-confirms their approvals.** `author_id` is
  `ON DELETE SET NULL`, and migration 0002 records that as deliberate: "the
  record outlives the author." Under this ADR that behaviour gains a second
  meaning it never had, because the confirmation state *is* that column. In the
  six-month scenario above, if the confirmer's account is gone the entry quietly
  reverts to reading "the AI wrote it, nobody vouched." Accepted rather than
  fixed: changing the FK to `RESTRICT` would block user deletion entirely, and a
  separate column is the thing this ADR declined. Recorded here so it is found
  rather than discovered.
- **`author_id` changes meaning across the table.** It used to be "the person
  who typed this." It is now "the person accountable for this," which is the
  same thing for human entries and a broader claim for AI ones. Any code reading
  it as authorship of the words is now subtly wrong, and `timeline/types.ts`
  should carry that on the field.
- **There is no representation for an edited draft**, by construction. If
  editing turns out to be something people want, that is the trigger to revisit
  `confirmed_by`, not a reason to bend the two states.
- **The two-state machine rides on a nullable foreign key.** It works, and it is
  less explicit than a column named for the job. Anyone reading the schema cold
  sees a nullable `author_id` and has to reach this ADR to learn that null and
  not-null are a workflow. The mitigation is a comment on the column in the
  migration and on the field in `timeline/types.ts`, both pointing here.
- **Existing rows are unaffected.** No backfill, no migration, nothing to
  coordinate across branches. That is the main thing this decision bought, and
  it is the reason it was worth taking at this point in the project rather than
  the more complete design.
