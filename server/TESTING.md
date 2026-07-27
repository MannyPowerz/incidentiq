# Running the server tests

## The short version

You need a throwaway database running before the tests will work. We run one
inside Docker so it never touches your real data. Once it is up, `npm test` does
the rest.

```bash
open -a Docker                     # start Docker, wait ~30s for it to boot
docker start incidentiq-test-db    # resume the test database (first time: see "First-time setup")
cd server && npm test
```

If all is well you will see something like `Test Files 2 passed (2)`.

## Why a separate database at all

**Plain:** the tests create and delete users, tokens, and incidents over and
over. You do not want that happening to the data you develop against.

**Formal:** the tests run against a dedicated *test database* pointed at by
`TEST_DATABASE_URL`, kept isolated from the *development database* in
`DATABASE_URL`. A "test database" is just a second, disposable copy of the same
schema that exists only so tests have somewhere safe to scribble — so
`TEST_DATABASE_URL` is really just "the throwaway database," written formally.

### Which database is used when

| What you run | Database it uses | Which one that is |
| --- | --- | --- |
| `npm run dev` (the app) | development database — `DATABASE_URL` | the real, persistent database you build against (this project's is hosted on Supabase) |
| `npm test` (the tests) | test database — `TEST_DATABASE_URL` | the throwaway Docker Postgres on port 5433 |

**Plain:** when you run the app, you talk to your real dev data; when you run the
tests, you talk to the disposable copy. Nothing you do in tests can touch the app's data.

**Formal:** the switch is automatic. `vitest.config.ts` sets `NODE_ENV=test`, and
`pool.ts` reads it — under test it connects with `TEST_DATABASE_URL`, otherwise
with `DATABASE_URL`. So "which database" is decided by `NODE_ENV`, which is just
"am I running tests right now or not," written formally.

## Why Docker

**Plain:** instead of installing Postgres directly on your Mac, Docker runs it
inside a sealed box you can start, stop, and throw away without leaving anything
behind.

**Formal:** Docker runs Postgres in a *container* — an isolated process built
from an *image* (`postgres:16`, a prebuilt snapshot of Postgres 16). A
"container" is basically that sealed box, and an "image" is basically the recipe
the box is stamped from. Before any of it works, the *Docker engine* (the
*daemon* — the background service the `docker` command talks to) must be running;
that is what "open Docker Desktop" starts. The daemon is just "Docker running in
the background."

## First-time setup — create the box

Run this **once**. After that the box exists and you only ever `start` it.

```bash
docker run --name incidentiq-test-db \
  -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=<pw> \
  -e POSTGRES_DB=postgres -p 5433:5432 -d postgres:16
```

Each flag, plain first then formal:

- `--name incidentiq-test-db` — a label so you can start/stop it by name. Formally
  the *container name*; same thing.
- `-e POSTGRES_USER=... POSTGRES_PASSWORD=... POSTGRES_DB=...` — the login details,
  which must match the ones inside `TEST_DATABASE_URL`. Formally *environment
  variables* handed to the container; an "environment variable" is just a setting
  passed to a program as it starts. `<pw>` is the password from your `server/.env`
  (the part between `postgres:` and `@` in `TEST_DATABASE_URL`).
- `-p 5433:5432` — sends anything hitting port `5433` on your Mac to port `5432`
  inside the box. Formally *port mapping* (publishing a port); Postgres normally
  listens on `5432`, and we expose it on `5433` so it will not clash with any
  Postgres already running on the default port. Port mapping is just "this outside
  door leads to that inside door."
- `-d` — run it in the background. Formally *detached mode*; detached just means
  "do not tie up my terminal."
- `postgres:16` — which image to build from. Formally the *image tag*
  (`name:version`); it is just "which prebuilt Postgres."

## Daily use — reuse the box

The box sticks around once created, so you do not re-create it:

```bash
docker start incidentiq-test-db    # resume the existing box
cd server && npm test
docker stop incidentiq-test-db     # optional: pause it when you are done
```

The one rule: `docker run` = **create** a new box, `docker start` = **wake** the
existing one. Running `docker run` on a name that already exists fails with
"container name already in use."

## What `npm test` actually does

**Plain:** it builds the tables in the test database, then runs every test file.

**Formal:** `vitest` runs with `NODE_ENV=test` (set in `vitest.config.ts`), so the
shared connection pool points at `TEST_DATABASE_URL`. A *global setup* step
(`tests/globalSetup.ts`) applies the *migrations* — the ordered `.sql` files that
build the schema — and a *per-test setup* (`tests/setup.ts`) *truncates* the
tables between tests so each one starts clean. "Migrations" are just "the scripts
that build the tables," and "truncate" is just "empty the tables."

## Resetting from scratch

If the box ever gets into a weird state, delete it and re-create:

```bash
docker rm -f incidentiq-test-db    # force-remove the box
# then run the "First-time setup" command again
```
