/**
 * constants.ts — the three numbers the relevance engine was tuned with.
 *
 * All three were invented, not measured. They are together in one file so nobody adjusts one
 * without seeing the other two, which is what happens when they live beside the code that uses them.
 *
 * Changing them changes ranking only. No type, shape, or behaviour depends on their values, so a
 * bad number makes the order worse and never breaks anything.
 *
 * What replaces guessing: real usage. Once people click or ignore surfaced entries, the archive in
 * `signatures_detected` has the data to fit these properly (ADR 0011).
 */

/** Days until a commit counts half as much. Two weeks ago you probably still remember the file. */
export const RELEVANCE_HALF_LIFE_DAYS = 14;

/** How far back "lately" goes for the frequency signal. Ownership ignores this and reads everything. */
export const FREQUENCY_WINDOW_DAYS = 30;

/** Commits inside the window that count as fully active. Past this everyone ties, which is fine: */
/** 12 and 40 both just mean "a lot", and nothing downstream reads the gap between them. */
export const FREQUENCY_CAP_COMMITS = 10;

/**
 * How much each signal counts toward the final score.
 *
 * They sum to 1 so the score lands on the same 0..1 scale as the signals feeding it.
 * Ownership is the largest deliberately: in an incident, who knows the code beats who edited it
 * last (ADR 0011). At these values, writing a module outscores fixing a typo in it this morning,
 * which is the failure that decision exists to prevent. Change them and re-check that still holds.
 */
export const WEIGHT_RECENCY = 0.3;
export const WEIGHT_FREQUENCY = 0.2;
export const WEIGHT_OWNERSHIP = 0.5;
