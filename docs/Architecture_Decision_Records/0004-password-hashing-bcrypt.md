# 0004 - Password hashing: bcrypt

## Context
`users.password_hash` needed a hashing algorithm. Compared three candidates via
`/options`: scrypt (Node's built-in `crypto`), bcrypt, and argon2 (argon2id).
The initial lean was scrypt, reasoned from "no new dependency, Node already
has it" — but that reasoning didn't hold once traced through: this app already
requires Socket.io, which forces a persistent, long-running server process,
ruling out the serverless/edge deploy targets where native/compiled
dependencies are a genuine hassle. At Minimum scope, none of the three
options' scale tradeoffs apply yet either.

## Decision
bcrypt, with `SALT_ROUNDS = 12` — a step above OWASP's stated floor of 10, not
the floor itself. This is a real latency/security tradeoff, not a free knob:
each `+1` to the cost factor doubles the work (`2^rounds` key-schedule
iterations), so 12 is 4x the compute of 10. In practice that lands around
~250ms per hash on current server hardware — slow enough to make brute-forcing
a stolen `password_hash` column expensive (an attacker pays that same ~250ms
per guess), fast enough that a real login request doesn't feel slow. Set via
`bcrypt.hash()` / `bcrypt.compare()`. Salt generation, output encoding, and
timing-safe comparison are handled internally by the library — nothing to
hand-roll.

## Alternatives rejected & why
- **scrypt (Node built-in `crypto`)** — zero new dependency, but the library
  gives you nothing beyond the raw primitive: salt generation, choosing an
  encoding to store salt+hash together, and timing-safe comparison
  (`crypto.timingSafeEqual`, never `===`) all become code this project has to
  own and keep correct. The dependency-avoidance motivation doesn't apply
  here, since Socket.io already commits the project to a normal persistent
  server rather than a serverless/edge target.
- **argon2 (argon2id)** — OWASP's current top recommendation, memory-hard by
  design. Rejected for now because its `memoryCost` parameter is a real
  per-request memory reservation; under a concurrent-login burst on a small
  server that could cause memory pressure bcrypt/scrypt would not. Not a
  concern at Minimum scope, but a real reason to revisit if the app reaches
  the concurrent-login-burst scale already discussed as an ambition.

## Consequences
- bcrypt is a native dependency (compiled addon). Expected to be a non-issue
  given the deploy targets compatible with Socket.io's persistent-server
  requirement; revisit if a future deploy target turns out to lack a
  prebuilt binary for it.
- bcrypt silently truncates passwords past 72 bytes. No mitigation added at
  Minimum scope — noted here so it isn't rediscovered as a surprise later.
- If the app scales to a genuine concurrent-login burst, argon2's
  memory-hardness becomes the more attractive tradeoff; this decision should
  be revisited at that point, not assumed permanent.
