# 0015 - Testing strategy: example-based tests, verified by mutation

## Context

Four suites exist across `server/tests` and nothing records how they are meant
to be written. Three people are contributing, there is no CI to encode the rules
implicitly, and `.github/` holds a pull request template and nothing else. Every
convention in place today lives only in the tests that happen to already follow
it.

The immediate trigger was narrower. 0013 recorded that the relevance engine's
0..1 invariant is enforced by assertions rather than types, and asked whether
property-based testing should close the remaining gap. Working through that
answer surfaced a reasoning that was not specific to relevance at all, and a
practice already being followed everywhere that had never been written down:
**no new test suite here has been trusted until a deliberate mutation killed
it.**

An undocumented practice is not a practice. It is a habit that ends with the
person who has it.

## Decision

### Two tiers, and the line between them is I/O

**Smoke tests** (`*.smoke.test.ts`) drive the HTTP surface with supertest
against a real Postgres. They own status codes, auth gates, org scoping, and
whether the wiring is actually connected.

**Unit tests** cover functions that take arguments and return values. They own
arithmetic, branching, and edge cases, and they run without a database.

A function that needs I/O to be tested is usually a function that has not been
separated from its I/O yet.

### The database is real, never mocked

`globalSetup.ts` runs the real migrations against `TEST_DATABASE_URL` before any
suite starts, and `setup.ts` truncates between tests. Suites run serially
(`fileParallelism: false`) because they share one pool.

A mocked database asserts that the code called the query it was told to call,
which is the same thing the code already says. The bugs actually worth catching
live in the SQL: a constraint name that does not match, an `ON CONFLICT` target
that is not the constraint it was meant to be, a `SELECT *` that pulls
`password_hash` across a join. None of those are reachable through a mock.

The cost is honest: the suite needs a live Postgres, so it cannot run on a
machine that has not been set up, and it is slower than it would otherwise be.

### A test is not trusted until a mutation kills it

Before a suite is considered done, break the code it covers on purpose and
confirm that **exactly the intended test fails and no others.** A test that
passes proves nothing on its own; a test that fails when the thing it describes
is broken has actually been verified.

This has caught real gaps rather than just confirming good ones. Removing
`updated_at = now()` from the fingerprint upsert is invisible to a naive
assertion because a column DEFAULT fires on INSERT and never on UPDATE. Raising
one relevance weight without lowering another was caught by a range test written
for a different purpose, which is how the 0..1 discipline turned out to be
better enforced than 0013 originally claimed.

**Mutation results go in the commit message** — which mutation, how many tests
died. That is the reviewer's evidence that the suite bites, and it is a claim
that cannot be made by looking at the diff.

### Purity is a testing decision, made at design time

`decayWeight` and `scoreTeammates` take `now` as a parameter instead of reading
the clock. That is not stylistic. It is what lets a test assert a 14-day-old
commit weighs **exactly** 0.5 rather than approximately a half, and a tolerance
is a place a real drift can hide.

Where a function is pure, assert exact values. Where it is not, assert what the
system actually guarantees — the fingerprint `updated_at` test compares
`EXTRACT(EPOCH FROM updated_at)` because JavaScript milliseconds and Postgres
microseconds do not agree, and comparing `Date` objects would have produced a
test that could never fail.

### Example-based, not property-based

Fixtures are chosen to sit on the edges that matter: past a cap, far older than
a half-life, future-dated, empty, zero-denominator. That is the coverage, and it
is deliberately not a proof.

Property-based testing (generating arbitrary inputs and asserting an invariant
survives all of them) is the tool that would turn it into one. **Not adopted.**
It is a new dependency and a new idea for three people mid-integration, and the
return is low against functions whose maths is four lines each and whose bounds
are visible by reading them. `Math.min(x, 1)` does not need a thousand generated
cases to prove it caps at 1.

The trigger to revisit is a function whose bound is an *argument* rather than an
inspection: several interacting signals, a combinatorial state machine, or a
parser. Not a general wish for more tests.

## Alternatives rejected & why

- **A coverage percentage as the bar** — rejected: coverage measures which lines
  ran, not whether anything would notice them breaking. Every mutation listed
  above was in a line already covered. Mutation is the more expensive measure and
  the only one that answers the question being asked.
- **Mocking the database** — rejected: fast and portable, and it moves the tests
  away from where the bugs are. It also makes the tests assert the
  implementation rather than the behaviour, so a correct refactor breaks them.
- **SQLite or an in-memory Postgres substitute** — rejected: the schema uses
  CITEXT, JSONB, `ON CONFLICT ON CONSTRAINT`, and `TIMESTAMPTZ` semantics.
  Testing against something that approximates those is testing a different
  database.
- **Property-based testing from the start** — rejected as above, with a trigger
  rather than a refusal.
- **Snapshot tests** — rejected: they pass by recording whatever the code
  currently does, which makes a wrong output permanent the moment somebody
  updates the snapshot to make the suite green.
- **Running suites in parallel** — rejected while they share one pool and
  truncate between tests. Parallel files would truncate each other's rows
  mid-run. Revisit with a schema or database per worker, which is real work and
  currently buys seconds.

## Consequences

- **None of this is enforced.** There is no CI, so a PR can merge with a red
  suite and nobody would know. Adding CI needs a Postgres service container and
  is a project-wide decision on its own merits; this ADR is the description of
  the practice, not a mechanism. Until then it lives in review.
- **Mutation testing is manual and leaves no artifact** except the commit
  message. Nothing stops it being skipped, and nothing detects that it was.
  Making it real means a mutation-testing runner in CI, which is downstream of
  having CI at all.
- **The suite cannot run without `TEST_DATABASE_URL`.** `globalSetup.ts` throws
  with instructions rather than failing obscurely, which is the mitigation.
- **`fileParallelism: false` makes the whole suite serial** and it will get
  slower with every new smoke test. The fix is known and deferred.
- **Writing a function to be testable is a design constraint, not a later
  concern.** Taking `now` as a parameter, keeping the relevance signal functions
  exported and separate, and keeping SQL in a query module the route calls are
  all the same decision reached three times. It is cheap in advance and
  expensive to retrofit.
- **The relevance 0..1 invariant remains assertion-enforced**, per 0013. This
  ADR records why that is the accepted level of rigour rather than a gap left
  open.
