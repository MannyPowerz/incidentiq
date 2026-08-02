# 0008 - AI request context: minimum input now, additive-optional expansion path

## Context
`draftFromContext` and its `buildPrompt` (server/src/ai/prompt.ts) currently
reason on `AiDraftRequest` = `{ incidentId, context, kind }`, where `context`
is a single pasted string (a log or scanner output). Design discussion
surfaced a real want: for the model to catch a *systemic* issue — not just the
first surface error a linter would already flag — and to judge relevance to
where the project is heading, it would help to feed it more than the pasted
string: the incident's own metadata, and eventually a document describing the
project's direction.

Those are genuine improvements and also genuine scope growth. This ADR fixes
what the Minimum feeds in now and lays the path to widen it without a rewrite.
It is the extensibility counterpart to 0006 (how the brain works) and 0007
(ship the Minimum first).

## Decision
The Minimum feeds the model only the pasted `context` and `kind`. All
expansion happens by **adding optional fields to `AiDraftRequest`** — existing
fields never change type or become required — so the shared contract in
types.ts (the seam the delivery half builds against) never breaks, and no new
field is forced onto every call. Two tiers, in order:

- **Near-term additive — the incident's own metadata.** `title`, `severity`,
  and `affected_system` already exist on the incident row and are already
  fetched by the delivery route's `findIncidentById` org gate, so passing them
  is near-free. Added as optional and spent selectively — not on every call —
  each carrying weight proportional to how much it grounds the draft in this
  specific incident.
- **Deferred scale-path — a project-direction document.** A curated Markdown
  file (in spirit like a CLAUDE.md, not identical) injected so the model can
  judge whether a finding is systemic to where the project is going. Deferred
  until there is evidence generic drafts fall short *and* someone owns keeping
  the document current.

## Alternatives rejected & why
- **Expand everything up front** (incident metadata + project doc + repo
  retrieval) — rejected: speculative scope, the exact over-engineering 0007
  defers. Retrieval/RAG especially is heavy infrastructure with no evidence
  yet that it earns its cost.
- **Make the added context required** (non-optional fields) — rejected: it
  would break the shared contract and force callers to supply data they may
  not have, coupling the brain to a richer request than every incident can
  provide.
- **Keep it permanently minimal** (never widen) — rejected: the systemic-issue
  reasoning genuinely needs more than a bare log to be its best. Recording the
  seam now is what lets that arrive smoothly later instead of as a rewrite.

## Consequences
- Expansion is additive and optional, so widening `AiDraftRequest` needs no
  migration and does not break the delivery half. `buildPrompt` must always
  treat the new fields as possibly-absent.
- The near-term metadata tier is cheap — the data is already fetched for the
  org gate — and can land whenever drafts would benefit; the delivery route
  passes what it already holds.
- The project-direction document, when adopted, brings real costs: token spend
  on every call, and staleness if the document is not maintained. That is why
  it is deferred behind evidence, not built now.
- Revisit the near-term tier when drafts visibly lack incident grounding.
  Revisit the deferred document when systemic-relevance misses become a
  pattern and a maintenance owner exists.
