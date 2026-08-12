# 0011 - Relevance engine: which signals score, which only explain

## Context
The relevance engine is split three ways — a git-log collector, the recency-decay
scoring, and the reason-string generator — with one owner each. They can only be
built in parallel if the shape passing between them is settled first, which is
the same lesson the AI service split taught when a stub had to stand in for a
missing contract.

Two things forced a decision beyond "what fields do we pass."

`docs/architecture.md` line 187 says **"Reason matters more than score — the UI
shows the reason."** That makes the scorer's output the reason generator's
vocabulary: a bare number leaves the generator with nothing to write but the
number. Whatever the reason is allowed to say has to exist as a separate field.

And an entry has to be connected to files before any of this works.
`timeline_entries` has no file column, and git history is entirely about files.
Nothing in the schema joins them today.

## Decision

**Scoring combines three named signals rather than producing one opaque
number**: recency, frequency, and ownership. Keeping them separate is what lets
the reason generator name whichever one dominated — "you changed this most
recently" and "you own most of this file" are different sentences from the same
scorer.

**Ownership is weighted above recency.** In an incident the useful answer is who
knows the code, not who happened to edit it last. Pure recency decay would rank
a typo fix this morning above the person who wrote the module, and the reason
string would say so out loud, which reads as broken rather than simple.

**Some data is display-only and never enters the maths.** Two fields carry this
marking today:

- `CommitTouch.subject`, the commit's subject line
- `TeammateScore.last_touch`, the most recent meaningful change

They exist because "Anthony touched this yesterday" and "Anthony renamed a
variable yesterday" lead to different decisions about whether to interrupt him,
and only the second is worth acting on. They do not score, because ranking on
commit-message text means guessing intent from prose.

**Merge commits are filtered at the collector**, not downstream. A merge credits
whoever pressed the button with every file in it, which inflates that person's
ownership and produces a worthless subject line on top.

**Author date, not commit date.** Rebasing rewrites commit dates, which would
make old work look recent.

**Entries connect to files by mapping the incident's system name to a
directory** for now, moving to agent-reported paths later. The agent already
watches the project and knows what it was looking at when a signature fired, so
it is the more accurate source; it is also unbuilt, and `affected_system`
already exists on the table. The swap does not change any type here — the paths
just arrive from somewhere better.

**The contract is additive-only.** Fields get added, never renamed or removed,
without telling the other two owners.

**Recency decays exponentially on a 14-day half-life**, rather than counting
fully until a cutoff and then nothing. A cutoff means a commit at day 29 counts
in full and day 31 counts zero, so someone's relevance collapses overnight for
no reason anyone can point at. 14 days is a guess and is written down as one:
someone who touched a file two weeks ago probably still has it in their head,
two months ago they do not.

**`decayWeight` takes the current time as a parameter** instead of reading the
clock itself. That keeps it pure, so a test can assert that a 14-day-old commit
weighs exactly 0.5 rather than approximately a half. Worth noting this is the
opposite call from `updated_at = now()` in the fingerprint upsert, where
reading the database's own clock was the entire point — there the value had to
come from one trusted source, here it has to come from the caller.

**A commit dated in the future scores zero, and is not clamped to 1.** A
negative age makes the weight exceed 1, so a single bad timestamp would
outweigh every legitimate commit combined. Clamping would cap the damage but
keeps untrusted data in the ranking; refusing it means a broken clock cannot
inflate anyone. The skew cannot be corrected where it is detected: git records
what that laptop believed, and there is no reference clock to compare against.

**Bad timestamps are detected, not prevented, for now.** The collector logs a
future-dated commit when it sees one; nothing stops it being created. Detection
sits in the collector rather than the scorer because it has the commit hash and
author, while the scorer only ever sees a weight that came out zero.

## Alternatives rejected & why
- **A single opaque score** — rejected: the smallest thing to build and the one
  that guarantees the reason generator has nothing to say. Directly contradicts
  architecture.md line 187.
- **Pure recency decay with no ownership term** — rejected as the model, though
  the decay itself is kept as one signal inside it. On its own it produces the
  typo-fixer-beats-the-author failure, which is the most visible way this
  feature can look stupid in a demo.
- **Scoring on commit-message keywords** — rejected: tempting, because the text
  is right there and words like "fix" or "revert" feel meaningful. It is intent
  inferred from prose, it rewards people who write certain commit messages, and
  it fails silently rather than loudly. This is the specific future change this
  ADR exists to have already answered.
- **Normalising every score against the team maximum** — considered and left
  out. It would make scores comparable across entries and neutralise prolific
  committers, but step 10 only orders, so it buys nothing the UI uses, and it
  makes the all-zero case worse rather than better.
- **Parsing file paths out of the entry body** — rejected as the join key: it
  needs no schema change and works on any entry, but for `ai_draft` entries the
  body is English prose written by the model, not the stack trace it read. The
  paths are in the AI's input, which is not stored.
- **A shared git hook rejecting future-dated commits** — rejected for now: it
  stops the problem at the earliest possible point, but hooks are not versioned
  with the repo, so every machine needs a one-time `core.hooksPath` step. The
  failure is circular — the person whose clock is broken is disproportionately
  the person who skipped the setup. New infrastructure for a problem that has
  not occurred.
- **A CI check failing PRs with future-dated commits** — rejected for now, and
  for a reason worth separating from this ADR: there is no CI in this repo at
  all. `.github/` holds a pull request template and nothing else. Adding the
  check means first deciding to run the suite on PRs, which needs a Postgres
  service container. That is worth doing on its own merits, but it is a
  project-wide decision and should not be motivated by clock skew.
- **Correcting skew rather than rejecting it** — rejected as unreachable
  locally. The techniques that work need a reference clock: a server-side
  receive time, which `architecture.md` line 44 rules out at Minimum with "no
  GitHub API", or parent-date monotonicity, since a commit cannot legitimately
  predate its parent. The second is available offline and is the real upgrade
  path, but it needs the collector to walk the commit graph rather than read a
  flat log, so it reshapes somebody else's piece.

## Consequences
- The collector must return commit subjects and skip merge commits. That is a
  format flag now and a re-parse later, which is why it was raised before the
  parsing was written.
- Three weights with no evidence behind them. They are guesses and should be
  written down as guesses. What replaces them is real usage: once people click
  or ignore surfaced entries, the weights stop being invented. The archive in
  `signatures_detected` was built for exactly that kind of mining.
- The display-only marking is a rule someone will break. It survives only
  because it is on the field in `types.ts`, in this ADR, and because both places
  say why rather than just what.
- Every future signal has to be classified as scoring input or display context
  before it is built. Co-change coupling and semantic similarity are both
  candidates; each slots in as another named signal rather than a rewrite,
  which is the main reason the three-signal shape was worth the extra work now.
- Two gaps are open and unowned, both recorded at the bottom of `types.ts`: git
  author emails are not guaranteed to match `users.email`, and nothing decides
  what the UI shows when every score is zero. Neither blocks starting, both
  block shipping.
- The system-name-to-directory map is maintained by hand in a repo that is
  actively being restructured — four socket files moved last week. It will rot.
  Keeping it in one file with a comment saying so is the cheap mitigation.
