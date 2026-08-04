# 0009 - AI model provider: switch to Google Gemini (free tier)

## Context
0006 recorded the initial model choice for `draftFromContext` as Claude
Sonnet 5 via `@langchain/anthropic`, reasoned from the task needing real code
comprehension rather than a cheapest/free tier. That reasoning still holds,
but a separate constraint surfaced afterward: Anthropic's API has no free
tier at all — every model is billed per token from the first request, with
at most a small one-time trial credit for new accounts. For continuing
development on the Minimum without a billed key, that rules out every
Claude model, including the cheapest (Haiku 4.5).

Google's Gemini API does offer a standing free tier (rate-limited, not
time-limited) on its Flash-class models, reachable through the same
LangChain message/structured-output surface `buildPrompt` and
`draftFromContext` already use. This ADR is scoped narrowly: it changes the
provider and model, not the architecture. Everything 0006 decided —
structured output composed with an explicit `aiDraftSchema.parse()` gate,
config-swappable model, fail-fast per 0007 — carries over unchanged.

## Decision
Use Google Gemini's free tier as the model provider for `draftFromContext`,
via `@langchain/google-genai` in place of `@langchain/anthropic`.
`@langchain/core` (the message types `buildPrompt` already imports) is
provider-agnostic and needs no change.

- **Package**: `@langchain/google-genai` replaces `@langchain/anthropic` in
  `server/package.json`.
- **Credential**: `GOOGLE_API_KEY` (env) replaces `ANTHROPIC_API_KEY`,
  obtained free from Google AI Studio (`https://aistudio.google.com/apikey`).
- **Model**: a current Gemini Flash-class model (e.g. `gemini-2.5-flash` or
  newer), set via env so it stays a one-line swap — same config-swappable
  design 0006 established for the Anthropic path. Gemini's model lineup
  moves quickly; check `https://ai.google.dev` for the current free-tier
  Flash model before hardcoding one.
- **Everything else in 0006 stands unchanged**: `withStructuredOutput`
  bound to `aiDraftSchema`, the explicit `.parse()` gate at the brain's
  exit, and fail-fast-via-throw with no retry (0007).

## Alternatives rejected & why
- **Stay on Anthropic, absorb the cost** — rejected: the point of this
  switch is to keep developing without a billed key while the project is
  still at Minimum scope; there is no free-tier path on Anthropic's API at
  any model tier.
- **Local models via Ollama** — rejected for now: genuinely $0 and provider-
  independent, but requires the developer's machine to run inference, which
  is a heavier dependency than an API key for a small team still building
  the Minimum. Worth reconsidering if free-tier rate limits become
  restrictive.
- **Rewrite the brain's internals around Gemini's native SDK instead of
  LangChain** — rejected: LangChain's message/structured-output abstraction
  is what made this a provider swap instead of a rewrite. Dropping it here
  would cost the exact flexibility 0006 was designed to keep.

## Consequences
- `draftFromContext` now depends on Google's API and its free-tier rate
  limits (requests/day, requests/minute) rather than Anthropic's pricing
  and limits. If the free tier's limits prove too restrictive for real
  usage, the next step is either a paid Gemini tier or reverting to 0006's
  original Anthropic path — both are one-line model/provider config changes
  given the LangChain abstraction, not a rewrite.
- Structured-output support and exact API shape can differ slightly by
  provider; verify `withStructuredOutput` behavior against
  `@langchain/google-genai`'s current docs when implementing the model
  client, rather than assuming Anthropic's semantics carry over exactly.
- Revisit this decision if the team later has budget for a paid tier and
  wants Sonnet-level reasoning quality back — 0006's reasoning for that
  quality bar was never wrong, it was overridden by the free-tier
  constraint, not disproven.
