# 0016 - Agent authentication: Dedicated Agent Credentials

## Context

The local agent (`agent-architecture.md`) is a headless process on a
developer's own laptop. It has no browser, and nobody sits at a prompt to type
a password every time it wakes up to scan. But every endpoint it calls —
`PUT /fingerprints`, `POST /incidents`, `POST /incidents/:id/draft` — requires
`Authorization: Bearer <token>`. Nothing in `architecture.md`, `contracts.md`,
or any prior ADR says how a process with no human attached gets that token.

Two constraints, stated explicitly during design rather than discovered
later, shaped the decision:

**The agent must not run unattended.** Not because an unattended process could
post something without approval — it can't; the private card defaults to `N`
and nothing reaches the server without an explicit `y` typed at that moment
(`agent-architecture.md` §6.5). The risk is narrower and different: a working,
authenticated session sitting on a machine for longer than necessary, on a
laptop that might itself be compromised.

**The credential's blast radius matters more here than for a typical
background job.** The agent runs on the exact machine this product exists to
watch for compromise — the same laptop `VPN_LOOPBACK` or a future signature
might flag. If that machine's disk is ever readable by an attacker, whatever
credential the agent holds is theirs too. A tool whose job is catching
environment compromise storing a plaintext credential on the environment it
watches is a real irony worth avoiding, not just a bad look.

## Decision

**Dedicated Agent Credentials.** A new credential type, separate from a
user's login password, issued once from an authenticated session and stored
by the agent instead of anything that unlocks the user's actual account.

- **A new table, `agent_credentials`**, one row per issued key: `user_id` (FK
  → `users`, `ON DELETE CASCADE`), `key_hash` (never the raw key — same
  never-store-the-secret principle as `users.password_hash` and
  `refresh_tokens.token_hash`), `label` (so a user can tell "Manny's laptop"
  from "Anthony's laptop" when deciding what to revoke), `created_at`,
  `revoked_at` (nullable = active, set = revoked — the exact pattern
  `refresh_tokens` already uses).
- **Issued via a new endpoint**, `POST /auth/agent-keys`, called once from a
  normal logged-in session. Generates the key with `signRefreshToken()`'s
  exact pattern (`randomBytes(32).toString('base64url')`), hashes it with
  `hashRefreshToken()`'s exact pattern (sha256), stores the hash, and returns
  the raw key **exactly once** — the same one-time-reveal convention as a
  GitHub personal access token. It is never retrievable again after that
  response.
- **Verified by a new middleware**, `requireAgentKey`, parallel in shape to
  `requireAuth`: reads `Authorization: AgentKey <key>`, hashes it, looks up
  `agent_credentials`, checks `revoked_at IS NULL`, resolves `user_id` →
  `org_id` through the FK, and populates `req.user` in the identical shape
  `requireAuth` already produces. Every existing handler —
  `findIncidentById(id, orgId)` included — needs zero changes to accept a
  request authenticated this way.
- **Revoked with one write**: `UPDATE agent_credentials SET revoked_at =
  now() WHERE id = $1`. No password touched. A stolen laptop means revoking
  one row, not resetting the account.

This is not new cryptography. It is the `refresh_tokens` pattern — a
hashed, revocable, database-backed secret separate from the password —
applied to a second credential type that already fits the shape this
codebase chose for exactly this problem once before.

## Alternatives rejected & why

- **A live access token pasted into agent config** — rejected outright:
  `ACCESS_TOKEN_TTL` is 15 minutes. A background process scanning on an
  interval would need re-pasting inside its first scan cycle. Not a real
  option, included only to be ruled out.
- **The refresh-token cookie, hand-extracted and pasted** — rejected: it
  works, `handleRefresh` does not care who presents a valid `refreshToken`
  cookie, but `httpOnly` cookies are not visible to a normal copy from the
  page — getting the raw value means pulling it out of a browser's Network or
  Application panel. That is more hostile to a person than typing a password,
  for no security benefit over the option below, since it authenticates as
  the full user either way.
- **Password in a config file, read automatically at every boot** — rejected
  as the standing case this ADR exists to avoid. A file on disk holding a
  live credential to the user's full account, sitting indefinitely on the
  machine the product watches for compromise, is exactly the blast-radius and
  irony problem above. It also cannot be revoked without changing the
  person's actual login password.
- **Password typed interactively at each agent startup, held only in
  memory** — the closest real competitor. It answers the unattended-start
  concern structurally — the process cannot begin without a human present to
  type it — and nothing persists to disk between sessions. It does not answer
  the blast-radius concern: a session compromised while running still
  authenticates as the user's whole account, with no scoping and no way to
  revoke the agent independently of the password. Dedicated Agent Credentials
  gives up nothing this option provides and adds revocability and scoping on
  top, at the cost of a migration and one endpoint this project already knew
  how to build.

## Consequences

- One migration (`agent_credentials`), one new endpoint, one new middleware.
  This is real feature work, not the documentation-only task the original
  Minimum-scope note for the agent assumed — scheduled and estimated
  separately in `schedule.md` rather than folded into this ADR's own hours.
- No key-management UI for the MVP. Issuing a key is one authenticated call;
  a page listing and revoking keys is a real Complete-tier feature and is not
  built now.
- The key does not expire on its own — same tradeoff `refresh_tokens`
  already accepted for its 30-day lifetime, except this key has no TTL at
  all until explicitly revoked. Acceptable because revocation is one write,
  and the alternative (a rotating short-lived agent token) is meaningfully
  more machinery for a two-person team's own two laptops.
- The key currently grants the same effective permissions as the user's own
  JWT — full account, not a narrowed scope. Scoping a key to only the
  routes the agent actually calls (`PUT /fingerprints`, `POST /incidents`,
  `POST /incidents/:id/draft`) is a real improvement and is named here as
  the next thing to build once more than one credential type needs
  distinguishing, not before.
- Every handler that currently calls `req.user!` is unaffected — the
  middleware populates the same shape, so `requireAgentKey` is a drop-in
  alternative to `requireAuth` on the routes the agent calls, not a parallel
  code path those handlers need to know about.
