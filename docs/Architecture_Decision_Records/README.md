# Architecture Decision Records (ADRs)

An Architecture Decision Record captures a significant technical decision:
what we chose, what we rejected, and why. Each decision is its own numbered file.

## Format

- **Context** — the problem and constraints
- **Decision** — what we chose
- **Alternatives rejected** — what we ruled out and why
- **Consequences** — what gets easier, harder, what debt we accept

## How to add one

1. Create a new file: `000N-short-title.md` (use the next number in sequence)
2. Use the format above
3. Add a line to the index below
4. Commit on your branch and open a PR

## Index

- [0001 — PostgreSQL as single source of truth](./0001-postgres-single-source-of-truth.md)
