# relevance

**Of everyone on this team, who most likely cares about what just happened?**

Step 8 in `docs/architecture.md`. An entry lands on an incident timeline, and
this ranks each teammate by how likely they are to have useful context on it,
based on who has been working in the files the incident touches.

It only orders a list. Nothing here decides what a person sees, only what order
they see it in.

## The pipeline

```
git log  ──►  collector  ──►  CommitTouch[]  ──►  scoring  ──►  TeammateScore[]  ──►  reason
             (Gabriella)                          (Manny)                          (Anthony)
```

Three owners, one contract in `types.ts`. Each stage takes its input as an
argument, so any of them can be built and tested against a fixture without the
other two existing.

## A worked example

An incident on `server/src/auth`. Ten commits have ever touched those files.

| | commits | last one | recency | frequency | ownership | **score** |
|---|---|---|---|---|---|---|
| Gabriella | 6 | 200 days ago | 0.0001 | 0.00 | 0.60 | **0.300** |
| Manny | 3 | 2 days ago | 0.9057 | 0.30 | 0.30 | **0.482** |
| Anthony | 1 | 45 days ago | 0.1077 | 0.00 | 0.10 | **0.082** |

Reading it left to right:

- **recency** is how fresh their *freshest* commit is. Gabriella's 200-day-old
  work has decayed to almost nothing; Manny's two-day-old commit is nearly 1.
- **frequency** counts commits inside the last 30 days. Anthony's single commit
  is 45 days old, so it falls outside the window and he scores 0 here even
  though it still counts toward his ownership.
- **ownership** is their share of all ten commits. It ignores age entirely.
- **score** is `0.3(recency) + 0.2(frequency) + 0.5(ownership)`.

The two things worth noticing:

**Gabriella beats Anthony even though his commit is far more recent.** She wrote
most of the code. In an incident, the person who knows the module is usually
more useful than the person who touched it last, and the weights are what
enforce that.

**Manny wins by being both.** Not the top on any single signal except recency,
but present on all three. That is the shape the scoring is meant to reward.

## The files

| file | what it holds |
|---|---|
| `types.ts` | the contract all three stages share. Start here. |
| `constants.ts` | the six tuned numbers, all of them guesses, kept together on purpose |
| `decay.ts` | one commit's weight given its age. Pure maths. |
| `score.ts` | the three signals and the weighted combination |

## Two things that will confuse you otherwise

**Nothing calls `scoreTeammates` yet.** That is not an oversight. It needs the
collector to produce `CommitTouch[]`, which is Gabriella's half and not merged.
The scorer is finished and tested against fixtures.

**`now` is a parameter everywhere instead of `Date.now()`.** That is what lets a
test assert a 14-day-old commit weighs exactly 0.5 rather than roughly a half.
Do not "simplify" it away.

## Where the reasoning lives

The comments in these files explain individual lines. The arguments behind the
design are in the ADRs:

- **0011** — which signals exist, why ownership outranks recency, and which
  fields are display-only and must never enter the maths
- **0012** — why the collector reads full history with no date cutoff
- **0013** — the arithmetic: why recency is a maximum rather than a sum, why
  frequency is capped, and what each number in the table above is doing
- **0015** — how these files are tested, and why the tests are verified by
  breaking the code on purpose
