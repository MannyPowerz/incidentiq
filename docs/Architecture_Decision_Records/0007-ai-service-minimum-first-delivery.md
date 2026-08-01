# 0007 - AI service delivery: ship Minimum, measure, add complexity on trigger

## Context
The AI service (`draftFromContext` plus the delivery route) invites several
"nice to have" complexities up front: retry-on-invalid-output, response
caching, an agentic clarify loop (ask -> wait -> re-answer), relevance
ranking, and a top-tier model. Each has a real cost — latency, spend, code,
new failure modes — and none has evidence yet that it is needed.

The project already operates at "Minimum scope" as a stated principle: 0004
and 0005 each defer a scale-driven choice until the scale actually arrives.
This ADR makes that principle explicit for the AI service and records the
specific deferrals, so they are deliberate and revisitable rather than
forgotten or silently added back in.

Why record it at all: the characteristic failure of an AI feature is
speculative complexity — building an agent or a cache for load that does not
exist. The counter-risk is under-building something genuinely needed. The
decision is to resolve that tension with evidence from real usage, not with
guesswork up front.

## Decision
Ship the Minimum first: a one-shot `draftFromContext` (structured output +
explicit parse, per 0006), a cheap-swappable balanced model, fail-fast on
invalid output — no retry, no cache, no agent. Get it working end to end, put
it in front of real usage (human reviewers approving drafts), and let observed
behavior decide the next increment.

Each deferred item carries an explicit revisit trigger, so "later" is a
condition, not a vibe:

- **Retry-on-invalid-output** (`parse` -> `safeParse` + one retry): add when
  the observed invalid-output rate from the chosen model is high enough that a
  single retry meaningfully raises success, and the added round-trip latency is
  acceptable. Rework cost is small (`parse` -> `safeParse`).
- **Response caching**: add when identical context is re-drafted often enough
  to matter for cost or latency.
- **Agentic clarify loop** (ask -> wait -> re-answer): add only if reviewers
  find one-shot drafts too often lack the context to be useful — and build it
  as a separate interactive component, not by widening `draftFromContext`'s
  contract (which the delivery half depends on).
- **Model tier change**: upgrade if drafts consistently need heavy editing;
  downgrade if cost dominates. One-line env change (0006).

## Alternatives rejected & why
- **Build the full pipeline up front** (retry + cache + agent + top-tier
  model) — rejected: speculative complexity. Each piece adds latency, spend,
  and failure modes that would have to be justified against load and quality
  data that do not exist yet. Over-engineering an AI path is easy to do and
  expensive to unwind.
- **Ship Minimum with no recorded triggers** — rejected: "we'll add it later"
  with no condition becomes either never (a real need is missed) or immediately
  (speculative build sneaks back in). Naming the trigger is what makes each
  deferral a real, checkable decision instead of a note.

## Consequences
- The first version visibly lacks retry, caching, and agentic behavior. This
  is intended; each gap has a named trigger above rather than being an
  oversight.
- The strategy only works if the Minimum is actually watched — invalid-output
  rate, reviewer edit effort, cost. If nobody measures, the default is to leave
  it as-is, which is the safe failure mode.
- Ties the AI service to the same Minimum-scope discipline as 0004 and 0005,
  keeping the project's ADRs consistent about when complexity is allowed in.
