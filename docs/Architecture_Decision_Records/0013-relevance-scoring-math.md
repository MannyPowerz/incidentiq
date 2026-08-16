# 0013 - The arithmetic of relevance scoring

## Context
0011 decided *which* signals exist and that ownership outranks recency. 0012
decided how far back the collector reads. Neither wrote down the arithmetic,
and the arithmetic turned out to carry decisions of its own.

Each signal starts as a list of commits and has to end as one number. There is
more than one way to collapse a list, and the ways disagree about who wins.
Those collapse choices are invisible in the output — every option produces a
plausible-looking number between 0 and 1 — so they are the part of this feature
most likely to be quietly wrong and never noticed.

One constraint runs through all of it: **every signal must land on 0..1 before
the weights are applied.** Without that the weights are meaningless, because
multiplying 0.5 against a raw commit count and 0.3 against a fraction compares
nothing to nothing.

## Decision

### Decay: `0.5 ** (ageInDays / 14)`

Halving every 14 days. The exponent is how many half-lives have elapsed, so the
weight is the fraction of the original that survives.

| age | half-lives | weight |
|---|---|---|
| 0 days | 0 | 1.0000 |
| 7 days | 0.5 | 0.7071 |
| 14 days | 1 | 0.5000 |
| 28 days | 2 | 0.2500 |
| 180 days | ~12.9 | 0.0001 |

Age 0 gives `0.5 ** 0 = 1`, the maximum, so no upper guard is needed. A negative
age would make the exponent negative and the weight exceed 1, which is why
future dates return 0 rather than being clamped (0011).

The curve is smooth, which is the whole argument for it. A cutoff at 30 days
means day 29 counts fully and day 31 counts nothing, so somebody's relevance
collapses overnight for no reason anyone can point at.

### Recency: the maximum weight, not the sum or the mean

Given N decay weights, recency is `max(...weights)`, seeded with 0.

**Summing fails on the second commit.** Two 14-day-old commits give
`0.5 + 0.5 = 1.0`, identical to one commit made this second, and ten give 5.
The 0..1 constraint dies immediately. Worse, the sum grows with the *number* of
commits, which means it is measuring frequency — the exact merge the
three-signal split exists to avoid.

**Averaging fails in the opposite direction: it punishes work.** One fresh
commit averages 1.0. That same fresh commit plus nine year-old ones averages
about 0.1. The more history someone has on a file, the lower they score on it.

The maximum is the only collapse that makes the number mean what the field is
called: *how fresh is their freshest work here*. It is also the collapse that
keeps `recency` and `last_touch` describing the same commit, which matters
because the reason generator shows one and ranks on the other.

### Frequency: `min(count / 10, 1)` over a 30-day window

A count is unbounded, so it is divided by a cap to bring it onto 0..1 and then
clamped so it stays there. 3 commits give 0.3; 10 give 1.0; 40 give 4.0 before
the clamp and 1.0 after.

Without the clamp, 40 commits returns 4 and this signal alone outweighs the
other two combined no matter what weights are chosen. The clamp is not
defensive tidying, it is what makes the weights mean anything.

**Everyone above the cap ties, accepted knowingly.** 12 and 40 both mean "this
person is hammering on this code," and nothing downstream reads the gap between
them. A log scale would preserve the distinction; it costs a second arbitrary
constant to buy resolution no consumer uses.

**The window is what keeps this signal independent of ownership.** Frequency is
windowed and absolute; ownership is all-time and relative. Three states become
distinguishable:

| | ownership | frequency |
|---|---|---|
| wrote it years ago, moved on | high | low |
| arrived last month, working on it now | low | high |
| wrote it and still active | high | high |

If frequency were also all-time, rows one and two would collapse together and
the third signal would be paying rent for information already present.

**The window rejects negative ages.** `ageMs >= 0 && ageMs <= windowMs`, not
just the upper bound. A future-dated commit is inside a naive window check, so
without the lower bound one broken laptop clock would raise a person's
frequency while contributing nothing to their recency — the two signals
disagreeing about the same commit.

### Ownership: `userTouches.length / totalTouches`

Naturally 0..1, so it needs no scaling. Guarded at zero, because 0/0 is `NaN`,
`NaN` compares false against everything, and a NaN score would scramble the
sort with no error anywhere.

**The denominator counts touches by everyone, including people who have left.**
This is the decision inside the decision. Dividing by roster-only touches makes
the shares total exactly 1, which looks tidier and is a lie: a departed
engineer's 40% would be silently redistributed, and someone who wrote 10% of a
file would read as owning 17% of it. With the full denominator the roster's
shares total 0.6, and that gap is a true and useful statement — *nobody still
here owns this.*

### Combination: a weighted average, weights summing to 1

```
score = 0.3(recency) + 0.2(frequency) + 0.5(ownership)
```

Because each signal is at most 1 and the weights total 1, the score is at most
1. The output lands on the same scale as its inputs, which is the payoff for
all the normalisation above.

The weights are the only thing enforcing 0011's ownership-over-recency
decision, and the check is arithmetic:

| | recency | frequency | ownership | score |
|---|---|---|---|---|
| wrote the module, quiet since | 0.0 | 0.0 | 1.0 | **0.50** |
| fixed a typo this morning, week one | 1.0 | 0.1 | 0.05 | **0.35** |
| wrote it and still active | 1.0 | 1.0 | 1.0 | **1.00** |

Row one beating row two is the entire point of 0011. Any change to the weights
has to reproduce this table or it has silently reversed that ADR.

Ownership at 0.5 also sets a deliberate boundary: it exactly equals perfect
recency plus perfect frequency combined (0.3 + 0.2). Knowing the code is worth
as much as being maximally active in it. Moving ownership to 0.6 makes knowing
it always win. Which side of that line is wanted is the real decision; the
decimals are just how it gets expressed.

### Scores are not sorted here, and not comparable across entries

`scoreTeammates` returns in roster order. Step 10 orders per reader, and a
score only means something against other people on the same entry.
Normalising against a team maximum was considered in 0011 and left out: it
would make scores comparable across entries, but nothing consumes that, and it
makes the all-zero case worse rather than better.

## Alternatives rejected & why
- **A single opaque score with no named signals** — rejected in 0011 and worth
  restating as an arithmetic point: once the three numbers are multiplied and
  added, the result cannot be decomposed back. `0.71` could be near-total
  ownership or a mix of everything, and the reason generator cannot tell which.
  Keeping the parts in `signals` costs three fields and is the only way the
  sentence can name what dominated.
- **Summed decay weights as recency** — rejected: unbounded, and it silently
  becomes a frequency measure. This is the most tempting wrong answer, because
  "add up how relevant each commit is" sounds like exactly the right sentence.
- **Mean decay weight as recency** — rejected: monotonically punishes having
  more history, which inverts the feature.
- **Log-scaled frequency, `log(1 + count) / log(1 + cap)`** — rejected as
  premature, not wrong. It distinguishes 12 from 40 where the cap ties them,
  which is more faithful to how commit counts actually distribute. It buys
  resolution nothing currently reads, at the cost of a second arbitrary
  constant and a formula that needs explaining. This is the upgrade if the
  cap's ceiling ever demonstrably matters.
- **Frequency as a share of the team's total** — rejected outright: ownership
  is already defined as a share of the total. The two would be the same number
  under two names, and three signals that cannot disagree are one signal with
  extra steps.
- **Decay-weighted commit count as a single combined signal** — rejected:
  `sum(decayWeight(t))` folds recency and frequency into one number, which is
  smaller and genuinely appealing. It makes ten old commits outrank one from
  this morning, and it destroys the reason generator's ability to say "you
  touched this most recently" as a distinct claim from "you touch this a lot".
- **Clamping future-dated commits to weight 1 instead of 0** — rejected in
  0011; the arithmetic reason is that a negative exponent makes `0.5 ** x`
  exceed 1 without bound, so a clock a year fast produces a weight of about
  6300 and one commit outranks the entire real history.
- **Weights that do not sum to 1** — rejected: nothing breaks, since step 10
  only orders, but the score stops being readable. 0.71 out of a ceiling of 1
  means something to a person reading a log; 1.42 out of a ceiling of 2.3 does
  not, and the first person to debug this will have to derive the ceiling.

## Consequences
- Six invented numbers now: the half-life, the frequency window, the frequency
  cap, and three weights. All six sit in `constants.ts` with a comment saying
  they are guesses and that real click data from `signatures_detected` is what
  replaces them. Isolating them is the mitigation; it does not make them less
  invented.
- The 0..1 discipline is load-bearing and unenforced by any type. `number` does
  not say "between zero and one", so a future fourth signal returning a raw
  count would break the weighting with no compiler error and no obviously wrong
  output. The three signal functions are exported individually so a test can
  hold each to its range.
- The weights table above is a test waiting to be written. Asserting that the
  quiet author outranks the fresh typo-fixer is the one test that fails if
  somebody retunes the weights past the point where 0011 still holds.
- `recencyOf` using the maximum means `last_touch` and the recency number always
  describe the same commit. That is currently a coincidence of both picking the
  newest touch, and it will stop being true if either one changes.
- Floating point makes these values inexact — `0.1 + 0.2` is
  `0.30000000000000004`. Irrelevant for ordering, and a reason not to assert
  exact combined scores in tests. The individual signal functions can be
  asserted exactly, which is why the decay tests use powers of two.
