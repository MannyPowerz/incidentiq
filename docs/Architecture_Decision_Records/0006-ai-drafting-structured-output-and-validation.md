# 0006 - AI incident drafting: LangChain structured output + explicit schema validation

> **Note:** the specific model/provider choice below (Claude Sonnet 5) is
> superseded by 0009 (switched to Google Gemini's free tier). The
> architecture recorded here — structured output + explicit validation gate,
> composed rather than either alone — is unchanged and still applies; only
> which provider fills that architecture changed.

## Context
`draftFromContext` (server/src/ai/draftFromContext.ts) is the "brain" of the
AI service: it takes incident context (a pasted log or scanner output) and
returns a structured `AiDraft` (`{ summary, why_it_matters, likely_fix }`,
defined by `aiDraftSchema` in server/src/ai/types.ts). Once a human approves
that draft, it becomes the body of an `ai_draft` timeline entry.

The core problem is that an LLM is nondeterministic and free-form, while the
contract promises a valid `AiDraft` or a clean failure. Every piece of this
decision exists to make an unreliable dependency behave like a dependable,
typed function. No LLM library was in the project (checked package.json);
`zod` (^4.4.3) already was, and the contract is already a zod schema.

The choice space was worked through with `/options` across two forks: how to
force structured output (Fork A), and where/how to validate it (Fork B). One
fact shaped the whole thing: the draft is human-reviewed before it is
persisted (the "approved draft" flow), which lowers the accuracy bar and
raises the value of cheap/fast — but the task is reading code and traces, so a
model too small to reason about a stack trace is a false economy.

## Decision
Compose two mechanisms deliberately, rather than picking one and moving on:

- **Structured output** via LangChain `withStructuredOutput` bound to
  `aiDraftSchema`. The zod contract does double duty — it shapes the model at
  the provider level *and* is the validation schema. This makes the output
  *shape* reliable without hand-rolled prompt-parsing.
- **An explicit `aiDraftSchema.parse()` at the exit** of `draftFromContext`.
  This is the owned trust boundary: it enforces constraints the provider does
  not guarantee, and keeps the function honoring "return a valid `AiDraft` or
  throw" regardless of how the guts are implemented or which provider is
  swapped in.

Structured output alone guarantees shape, not content; the explicit parse is
what makes the guarantee ours instead of the library's. Composing both beats
either in isolation, which is the point of the decision.

Supporting choices:
- `aiDraftSchema` is tightened so `summary`, `why_it_matters`, and
  `likely_fix` are non-empty (`.min(1)`). Structured output guarantees the key
  exists and is typed `string`, but `""` is a valid string; only the stricter
  schema catches an empty-but-well-shaped draft.
- The model is config-swappable via env, starting at the balanced tier
  (Claude Sonnet 5). Chosen over the cheapest tier because the value of
  `why_it_matters` / `likely_fix` depends on the model actually comprehending
  a log or scanner trace, not just summarizing it.
- On invalid output, `draftFromContext` **throws** a typed error — the return
  type `Promise<AiDraft>` has no error variant — and the delivery route maps
  error types to HTTP status. Fail-fast is the Minimum; the deferred retry is
  recorded in 0007.

## Alternatives rejected & why
- **Prompt-and-parse** (ask for JSON in the prompt, `JSON.parse`, then
  validate) — rejected as the default: least reliable, the model can wrap JSON
  in prose or markdown fences or drop keys, pushing all repair logic onto us.
  Kept as the fallback path if a future model lacks native structured output,
  which is why `buildPrompt` stays separable.
- **Structured output alone, no explicit parse** (rely on LangChain's internal
  zod check) — rejected: outsources our trust boundary to a library's current
  behavior, and shape-guaranteed is not content-valid. The gate would silently
  vanish the day structured output is swapped out.
- **Explicit parse alone, no structured output** — considered and folded in
  rather than chosen alone: parse-and-throw is the right gate, but without
  structured output the model misbehaves more often, so the two compose better
  than either by itself. This composition is the decision above.
- **Provider SDK directly, no LangChain** — rejected for now: fewer layers,
  but diverges from the team's stated LangChain plan and loses provider-swap
  flexibility.
- **Cheapest / free model tier** — rejected as the starting default: the task
  requires code comprehension, so a summarizer-grade model produces low-value
  why/fix. Still reachable via env config if cost forces it.
- **Agentic clarify-loop** (model asks clarifying questions instead of
  failing) — rejected for Minimum: `draftFromContext` is one-shot, and a
  clarify loop would break the frozen contract the delivery half builds against
  and reintroduce the multi-turn latency we explicitly wanted to avoid. Noted
  as a possible v2 built as a separate interactive component, not by widening
  this contract (see 0007).

## Consequences
- Adds LangChain plus an LLM provider SDK as dependencies, and an external
  network call (cost + latency) into the draft path. New failure modes
  (timeout, refusal, malformed output) all resolve to a typed throw at the
  brain boundary.
- `withStructuredOutput` binds us to models that support tool/structured
  output. The day a required model doesn't, we fall back to the prompt-and-parse
  path — which is why `buildPrompt` is kept separable from the model call.
- Structured output guarantees shape, not truth. The non-empty schema and the
  human review are the two lines of defense on content quality.
- Model tier is a one-line env change. Revisit if reviewers find drafts
  consistently need heavy editing (upgrade) or if cost dominates (downgrade).
