// decay.ts — how much one commit still counts, given how old it is. Pure maths, no I/O.

/**
 * Days until a commit counts half as much. The only knob in this file.
 *
 * 14 is a guess, and should be read as one: someone who touched a file two weeks ago probably still
 * has it in their head, two months ago they do not. Real usage replaces it later (ADR 0011).
 */
export const RELEVANCE_HALF_LIFE_DAYS = 14;

const MS_PER_DAY = 1000 * 60 * 60 * 24;

/**
 * Weight for one commit: 1 for just now, fading toward 0 as it ages.
 *
 * `now` is a parameter rather than Date.now() so this stays pure and a test can assert exact values
 * instead of "roughly a half". The opposite call from `updated_at = now()` in the fingerprint
 * upsert, where reading the database's own clock was the whole point.
 *
 * Exponential rather than a cutoff after N days: a cutoff means a commit at day 29 counts fully and
 * day 31 counts nothing, so someone's relevance collapses overnight for no real reason.
 */
export function decayWeight(committedAt: Date, now: Date): number {
    const ageInDays = (now.getTime() - committedAt.getTime()) / MS_PER_DAY;

    // A future date means a broken clock, and a negative age makes the weight exceed 1, so one bad
    // -> commit would outweigh every real one combined. Score it nothing.
    // Not clamped to 1: clamping keeps untrusted data in the ranking instead of refusing it.
    // The skew cannot be corrected here — git records what that laptop believed, with no reference
    // -> to compare against. Noticing it belongs in the collector, which has the hash and author.
    // Later: a commit cannot legitimately predate its parent, so walking the commit graph instead of
    // -> a flat log would let a bad date be repaired rather than dropped.
    if (ageInDays < 0) return 0;

    // Age 0 gives 0.5 ** 0 = 1, so a commit made this second is the maximum. No guard needed for it.
    return 0.5 ** (ageInDays / RELEVANCE_HALF_LIFE_DAYS);
}
