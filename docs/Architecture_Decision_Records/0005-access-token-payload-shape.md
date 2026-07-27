# 0005 - Access token payload shape: org_id and role embedded, stateless

## Context
`AccessTokenPayload` (server/src/auth/types.ts) needed to decide which user
facts ride inside the signed access token vs. get looked up from the database
per request. `requireAuth` (server/src/auth/middleware.ts) only ever calls
`verifyAccessToken` — no DB call in the auth gate itself — so anything not in
the payload has to be fetched by whichever route needs it, on every request
that needs it.

Two fields were in question: `org_id` and `role`. (`sub`, the user id, was
never in question — every payload needs an identity claim.)

## Decision
Both `org_id` and `role` are embedded in the payload, alongside `sub`. Full
payload: `{ sub, org_id, role }`. The rationale differs per field:
- `org_id`: `users.org_id` is `NOT NULL` with no org-reassignment path
  anywhere in the schema (0001_orgs_users.sql) — it cannot go stale for a
  user's lifetime, so embedding it costs nothing.
- `role`: can change (promotion/demotion). Embedding it trades a small,
  bounded staleness window — capped at `ACCESS_TOKEN_TTL` (15 minutes) — for
  avoiding a DB hit on every authenticated, read-heavy request.

## Alternatives rejected & why
- **DB lookup per request** (payload holds only `sub`; each route that needs
  `org_id`/`role` queries `users` by id) — rejected as the default: for a
  read-heavy path, this adds a database round trip to every request that
  touches tenant or permission data, for freshness that `org_id` never needs
  and `role` only needs on the rare tick where a promotion/demotion just
  happened.

## Consequences
- A role change (promotion/demotion) does not take effect until the user's
  current access token expires — worst case, 15 minutes (`ACCESS_TOKEN_TTL`
  in tokens.ts). This is a deliberate, bounded staleness window, not an
  oversight.
- If a future feature needs role changes to apply instantly (e.g. an admin
  force-demotes a user mid-incident), this decision has to be revisited —
  either shorten the TTL, or move `role` specifically back to a per-request
  lookup while keeping `org_id` embedded.
- `org_id` has no such caveat: it's safe to treat as permanent for as long as
  the schema has no org-reassignment path. If that ever changes, this
  decision needs revisiting for `org_id` too.
