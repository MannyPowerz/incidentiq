/**
 * score.ts — turns a pile of commit touches into one ranked number per teammate.
 *
 * Step 8 in docs/architecture.md, between Gabriella's collector and Anthony's reason generator.
 * Reads only its arguments, writes nothing, touches no clock: a test can hand it fixtures and
 * assert exact numbers. `now` is a parameter for the same reason it is one in decay.ts.
 *
 * The three signals stay separate all the way to the output so the reason generator can name
 * whichever one dominated. Collapsing them into a single number would leave it nothing to say.
 */
import type {
    CommitTouch,
    RelevanceContext,
    TeammateScore,
    TeamMember
} from './types.js';
import { decayWeight, MS_PER_DAY } from './decay.js';
import {
    FREQUENCY_CAP_COMMITS,
    FREQUENCY_WINDOW_DAYS,
    WEIGHT_RECENCY,
    WEIGHT_FREQUENCY,
    WEIGHT_OWNERSHIP
} from './constants.js';

/**
 * Git emails and roster emails have to be compared the same way in both directions.
 * users.email is CITEXT, so Postgres already treats these as one person; a JS Map does not.
 * Without this, one capitalised git config drops someone from every score with no error anywhere.
 */
function normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
}

/**
 * How fresh is their freshest commit. 0..1.
 *
 * The best single weight, not the sum of all of them. Summing breaks the ceiling on the second
 * commit and quietly folds frequency back into recency. Averaging is worse: it punishes people for
 * having more history, so one fresh commit beats one fresh commit plus nine old ones.
 *
 * The 0 seed is the answer for someone with no touches. Math.max() on nothing returns -Infinity.
 */
export function recencyOf(userTouches: CommitTouch[], now: Date): number {
    // reduce carries one running value across the list. bestSoFar is it, and 0 is where it starts.
    const best = userTouches.reduce(
        (bestSoFar, touch) => Math.max(bestSoFar, decayWeight(touch.committed_at, now)),
        0
    );

    return best;
}

/**
 * How much they have been on these files lately. 0..1.
 *
 * A count over a cap, so above the cap everyone ties at 1. That is the point: 12 commits and 40
 * both just mean "a lot", and nothing downstream reads the gap. Without the cap, 40 commits
 * returns 4 and this signal alone outweighs the other two combined.
 *
 * Windowed and absolute, where ownership is all-time and a share. A share of the team's total here
 * would be ownership under a second name, and then two of the three signals could never disagree.
 */
export function frequencyOf(userTouches: CommitTouch[], now: Date): number {
    const windowMs = FREQUENCY_WINDOW_DAYS * MS_PER_DAY;

    const recent = userTouches.filter((touch) => {
        const ageMs = now.getTime() - touch.committed_at.getTime();

        // Negative age means a future date, i.e. a broken clock on the machine that made it.
        // decayWeight already refuses those, so counting them here would let one bad timestamp
        // -> raise a person's frequency while contributing nothing to their recency.
        return ageMs >= 0 && ageMs <= windowMs;
    });

    // 3 commits over a cap of 10 is 0.3. 40 is 4.0, and min drags it back down to 1.
    const frequency = Math.min(recent.length / FREQUENCY_CAP_COMMITS, 1);

    return frequency;
}

/**
 * Their share of everything that ever happened to these files. 0..1.
 *
 * The denominator counts touches by everyone, including people who have left, so the roster's
 * shares can add up to less than 1. That gap is real information: it says nobody still here owns
 * this. Dividing by roster-only touches would silently hand a departed engineer's work to whoever
 * is left, and someone who wrote 10% of a file would read as owning 17% of it.
 */
export function ownershipOf(userTouches: CommitTouch[], totalTouches: number): number {
    // No history at all. Guarding this is what stops a 0/0 NaN spreading into every weighted sum,
    // -> where it would compare false against everything and scramble the sort with no error.
    if (totalTouches === 0) return 0;

    const ownership = userTouches.length / totalTouches;

    return ownership;
}

/**
 * DISPLAY ONLY. The most recent thing they did to these files, or null if they did nothing.
 *
 * A junk subject like "wip" still comes through populated. Whether it is worth showing is a
 * question about the finished sentence, so it belongs to the reason generator (ADR 0011).
 *
 * The empty check has to come first: reduce with no initial value throws on an empty array.
 */
function lastTouchOf(userTouches: CommitTouch[]): TeammateScore['last_touch'] {
    if (userTouches.length === 0) return null;

    // No starting value this time, so reduce begins at the first touch and keeps whichever is later.
    const latest = userTouches.reduce((newest, touch) =>
        touch.committed_at > newest.committed_at ? touch : newest
    );

    return {
        file_path: latest.file_path,
        subject: latest.subject,
        at: latest.committed_at
    };
}

export function scoreTeammates(
    touches: CommitTouch[],
    roster: TeamMember[],
    context: RelevanceContext,
    now: Date
): TeammateScore[] {
    // startsWith rather than an exact match, because file_paths currently holds directories mapped
    // -> from the incident's affected_system, and will hold exact files once the agent reports them.

    // Exact equality would match nothing today and every score would come out zero.
    
    // some() collapses the whole path list into one yes/no, which is the answer filter() keeps on.
    const relevant = touches.filter((touch) =>
        context.file_paths.some((path) => touch.file_path.startsWith(path))
    );

    // Ownership's denominator. Every touch on these files by anyone, which is what `relevant` is.
    const totalTouches = relevant.length;

    // The bridge: git knows people by email, TeammateScore knows them by user_id.
    const userIdByEmail = new Map<string, number>();
    for (const member of roster) {
        userIdByEmail.set(normalizeEmail(member.email), member.user_id);
    }

    const touchesByUser = new Map<number, CommitTouch[]>();
    const unmatchedAuthors = new Set<string>();

    for (const touch of relevant) {
        const userId = userIdByEmail.get(normalizeEmail(touch.author_email));

        // An author git knows and the roster does not. Their work vanishes from every score, and
        // -> this is the only place that still knows the address, so it gets collected rather than
        // -> dropped. A Set and one warning after the loop, because warning per touch would print
        // -> the same address hundreds of times. Detect, do not prevent — same call as clock skew.
        if (userId === undefined) {
            unmatchedAuthors.add(touch.author_email);
            continue;
        }

        // Nothing is in the map the first time we reach a person, and you cannot push onto
        // -> undefined, so `?? []` supplies the bucket that set() then puts back.
        const existing = touchesByUser.get(userId) ?? [];
        existing.push(touch);
        touchesByUser.set(userId, existing);
    }

    if (unmatchedAuthors.size > 0) {
        console.warn(
            `relevance: ${unmatchedAuthors.size} git author(s) not on the roster, excluded from scoring: ${[...unmatchedAuthors].join(', ')}`
        );
    }

    // Mapping the roster, not the touches, so everyone gets a row even with no history here.
    // The reason generator needs a line for the all-zero case either way, and an absent person is
    // -> harder for it to explain than a present one scoring zero.
    const scores = roster.map((member) => {
        const userTouches = touchesByUser.get(member.user_id) ?? [];

        const recency = recencyOf(userTouches, now);
        const frequency = frequencyOf(userTouches, now);
        const ownership = ownershipOf(userTouches, totalTouches);

        // Weighted average, not a plain sum. A plain sum maxes at 3 instead of 1 and counts all
        // -> three signals equally, which is exactly what ADR 0011 decided against.
        // 0.3(0.9) + 0.2(0.2) + 0.5(0.8) = 0.71. The ceiling is 1 because the weights add to 1.
        const score =
            WEIGHT_RECENCY * recency +
            WEIGHT_FREQUENCY * frequency +
            WEIGHT_OWNERSHIP * ownership;

        return {
            user_id: member.user_id, score,
            signals: { recency, frequency, ownership },
            last_touch: lastTouchOf(userTouches)
        };
    });

    // Unsorted on purpose. Step 10 orders these per reader; sorting here would imply one global
    // -> ranking, and `score` is only meaningful against other people on the same entry.
    return scores;
}
