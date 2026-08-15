# 0012 - Relevance collector reads full git history, with no date cutoff

## Context
0011 settled what the relevance engine measures: recency, frequency, and
ownership as three named signals, with ownership weighted highest because in an
incident the useful answer is who knows the code rather than who edited it last.

It did not settle how far back the collector reads. That looked like a
performance question and turned out to be a correctness one, for two reasons.

The choice lives in the collector and the damage lands in the scorer. A cutoff
is a single argument in one person's `git log` call; the signal it degrades is
in a different file owned by a different person. Nothing about a 90-day window
looks wrong where it is written.

And a window is easy to confuse with the half-life. Both sound like "how far
back do we care", so it is tempting to set one to reinforce the other.

## Decision

**The collector reads full history. No date cutoff, no `--since`.**

The reasoning is that **the window and the half-life do different jobs, and only
one of them is needed.**

The half-life already decides how much recent work matters. At the 14-day
half-life from 0011, a commit six months old weighs 0.0001 — it is already
invisible to the recency signal. A cutoff on top of that does not make recent
work count for more, because decay has done that. All a cutoff removes is data
old enough that only one signal was still reading it, and that signal is
ownership: the one weighted highest.

So a window buys nothing that is not already handled, at the cost of the thing
0011 decided mattered most.

**The product argument is the stronger half of this.** Consider what happens
when a module nobody has touched in six months breaks. Under a 90-day window
every score is zero and the app has nothing to say. Under full history it says
"Gabby wrote this, she has not been near it in a while, but she is who you
want."

That second answer is the feature. The case where nobody has recent activity is
exactly the case where relevance is most valuable, because it is the case where
a human has no idea who to ask. A window switches the feature off in precisely
the situation it exists for.

**Frequency is windowed inside the scorer, not the collector.** If frequency is
to mean "how active have they been lately" rather than "how many commits ever",
that is a scoring decision, and it belongs with the person who knows what the
signal is for. Computing frequency and ownership over the same span would also
make them near-duplicates — a count and a share of the same count — which
defeats the point of separating them at all.

## Alternatives rejected & why
- **A fixed window, e.g. 90 days** — rejected: it silently redefines ownership
  as recent ownership. Someone who wrote a module in month one and moved on
  scores zero on it, which quietly reverses 0011's decision to weight ownership
  above recency. The setting would live in the collector and the failure would
  appear in the scorer, which is the worst possible separation between cause and
  symptom.
- **A window derived from the half-life** — rejected, though the reasoning is
  sound as far as it goes: past roughly six half-lives the decay weight is under
  0.02, so those commits genuinely cannot move recency. That is correct for one
  of three signals and wrong for the one that is not decayed at all. It is the
  right answer to a question nobody is asking.
- **Two windows — recent for recency and frequency, full for ownership** —
  rejected as premature rather than wrong. It is where this goes if full history
  ever becomes expensive, and choosing full history now means arriving there
  without rework, since the collector would only be narrowing what it already
  returns.
- **A window adjustable per incident room** — rejected: at incident time nobody
  tunes a lookback period, they are trying to fix something. A control that only
  gets set correctly by someone who already understands the scoring model is one
  that stays on its default permanently. It would also make two incidents'
  scores incomparable. If a knob is ever wanted, the half-life is the one to
  expose, because it changes how signals weigh rather than what data exists.

## Consequences
- Gabriella has no window decision to make, which removes the coupling entirely
  rather than managing it. No local choice in the collector can degrade the
  scorer's highest-weighted signal, because there is no choice left to make.
- Full history is cheap on a repository a few months old with three
  contributors. It will not always be, and nothing will announce when that
  changes. The collector should carry a comment saying the absence of a window
  is deliberate, so whoever eventually adds one knows they are trading ownership
  accuracy for speed rather than tidying up an oversight.
- Frequency's span becomes the scorer's decision, and an unstated one until it
  is made. Recency and ownership are both naturally bounded to 0..1; a raw
  count is not, so it needs bringing onto the same scale before the weights in
  0011 mean anything.
- Ownership now genuinely means what 0011 claims: share of a file's whole
  history, not share of a recent slice of it.
