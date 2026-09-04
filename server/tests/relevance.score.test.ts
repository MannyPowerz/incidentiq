/**
 * relevance.score.test.ts — the scoring arithmetic, asserted at exact values.
 *
 * Everything here is a plain argument in and a plain value out, including the clock, so there is
 * no database and no tolerance to hide a drift in. That is what `now` being a parameter bought.
 *
 * The three signal functions are tested on their own because the collapse choices in ADR 0013 are
 * invisible in the combined score: sum, mean and max all produce a plausible number between 0 and
 * 1, so a wrong one looks exactly like a right one unless something pins it down here.
 */

import { describe, expect, it, vi } from 'vitest';
import {
    recencyOf,
    frequencyOf,
    ownershipOf,
    scoreTeammates
} from '../src/relevance/score.js';
import {
    FREQUENCY_CAP_COMMITS,
    FREQUENCY_WINDOW_DAYS
} from '../src/relevance/constants.js';
import type {
    CommitTouch,
    RelevanceContext,
    TeamMember
} from '../src/relevance/types.js';

const NOW = new Date('2026-08-17T12:00:00Z');
const MS_PER_DAY = 1000 * 60 * 60 * 24;

const daysAgo = (days: number) => new Date(NOW.getTime() - days * MS_PER_DAY);

const touch = (
    email: string,
    daysOld: number,
    file = 'server/src/auth/tokens.ts',
    subject = 'tighten the refresh check'
): CommitTouch => ({
    author_email: email,
    file_path: file,
    committed_at: daysAgo(daysOld),
    subject
});

const many = (count: number, email: string, daysOld: number) =>
    Array.from({ length: count }, () => touch(email, daysOld));

const MANNY: TeamMember = { user_id: 1, email: 'manny@incidentiq.dev' };
const GABBY: TeamMember = { user_id: 2, email: 'gabriella@incidentiq.dev' };

// file_paths holds a directory today, which is why the filter uses startsWith (ADR 0011).
const CONTEXT: RelevanceContext = {
    entry_id: 40,
    incident_id: 7,
    file_paths: ['server/src/auth']
};

describe('recencyOf', () => {
    it('is zero for someone with no touches', () => {
        expect(recencyOf([], NOW)).toBe(0);
    });

    it('is the full weight for a commit made right now', () => {
        expect(recencyOf([touch(MANNY.email, 0)], NOW)).toBe(1);
    });

    // the collapse choice. Summing would give 1.0 here, indistinguishable from a commit made this
    // -> second, and it would keep climbing with every extra commit until it left the 0..1 range.
    it('takes the best weight rather than the sum of them', () => {
        const twoHalfLifeOldCommits = [touch(MANNY.email, 14), touch(MANNY.email, 14)];

        expect(recencyOf(twoHalfLifeOldCommits, NOW)).toBe(0.5);
    });

    // the other collapse choice. Averaging would give roughly 0.1 here, so having more history
    // -> would lower the score. The freshest commit is the same in both cases and should win both.
    it('is not dragged down by old commits sitting beside a fresh one', () => {
        const freshOnly = [touch(MANNY.email, 0)];
        const freshPlusAncient = [touch(MANNY.email, 0), ...many(9, MANNY.email, 365)];

        expect(recencyOf(freshPlusAncient, NOW)).toBe(recencyOf(freshOnly, NOW));
    });
});

describe('frequencyOf', () => {
    it('is zero for someone with no touches', () => {
        expect(frequencyOf([], NOW)).toBe(0);
    });

    it('is the count over the cap while under the cap', () => {
        expect(frequencyOf(many(3, MANNY.email, 1), NOW)).toBe(0.3);
    });

    // without the clamp this returns 4, and one signal outweighs the other two combined
    // -> no matter what weights are chosen.
    it('ties everyone above the cap at one', () => {
        const atCap = frequencyOf(many(FREQUENCY_CAP_COMMITS, MANNY.email, 1), NOW);
        const wellPast = frequencyOf(many(FREQUENCY_CAP_COMMITS * 4, MANNY.email, 1), NOW);

        expect(atCap).toBe(1);
        expect(wellPast).toBe(1);
    });

    // the window is what keeps this signal from becoming a second copy of ownership.
    it('ignores commits older than the window', () => {
        const oneRecentAndFiveOld = [
            touch(MANNY.email, 1),
            ...many(5, MANNY.email, FREQUENCY_WINDOW_DAYS + 10)
        ];

        expect(frequencyOf(oneRecentAndFiveOld, NOW)).toBe(0.1);
    });

    // a naive "age <= window" check is true for a negative age too, so one broken laptop clock
    // -> would raise frequency while contributing nothing to recency. The two must agree.
    it('ignores future-dated commits, the same as the decay curve does', () => {
        const fromNextWeek = [touch(MANNY.email, -7)];

        expect(frequencyOf(fromNextWeek, NOW)).toBe(0);
        expect(recencyOf(fromNextWeek, NOW)).toBe(0);
    });
});

describe('ownershipOf', () => {
    it('is the share of every touch on these files', () => {
        expect(ownershipOf(many(3, MANNY.email, 1), 10)).toBe(0.3);
    });

    it('is one when they are the only person in the history', () => {
        expect(ownershipOf(many(4, MANNY.email, 1), 4)).toBe(1);
    });

    // 0/0 is NaN, NaN compares false against everything, and the sort would scramble with no error.
    it('is zero rather than NaN when nobody has ever touched these files', () => {
        expect(ownershipOf([], 0)).toBe(0);
    });
});

describe('scoreTeammates', () => {
    // THE test. The weights are the only thing enforcing ADR 0011's ownership-over-recency
    // -> decision, so this is what fails if someone retunes them past the point it still holds.
    it('ranks the author who has gone quiet above the fresh typo fixer', () => {
        const touches = [...many(9, MANNY.email, 400), touch(GABBY.email, 0)];

        const [manny, gabby] = scoreTeammates(touches, [MANNY, GABBY], CONTEXT, NOW);

        expect(manny.signals.ownership).toBe(0.9);
        expect(gabby.signals.recency).toBe(1);
        expect(manny.score).toBeGreaterThan(gabby.score);
    });

    it('returns everyone on the roster, in roster order, unsorted by score', () => {
        const touches = [touch(GABBY.email, 0)];

        const scores = scoreTeammates(touches, [MANNY, GABBY], CONTEXT, NOW);

        expect(scores.map((s) => s.user_id)).toEqual([MANNY.user_id, GABBY.user_id]);
        expect(scores[0].score).toBeLessThan(scores[1].score);
    });

    it('gives a teammate with no history here a zero row rather than omitting them', () => {
        const [manny] = scoreTeammates([touch(GABBY.email, 0)], [MANNY, GABBY], CONTEXT, NOW);

        expect(manny.score).toBe(0);
        expect(manny.signals).toEqual({ recency: 0, frequency: 0, ownership: 0 });
        expect(manny.last_touch).toBeNull();
    });

    // CITEXT makes these one person in Postgres. A JS Map does not, so both sides get normalised
    // -> or a capitalised git config silently drops someone from every score.
    it('matches a git author whose email differs only in case or padding', () => {
        const shouty = touch('  MANNY@IncidentIQ.DEV ', 0);

        const [manny] = scoreTeammates([shouty], [MANNY, GABBY], CONTEXT, NOW);

        expect(manny.signals.ownership).toBe(1);
    });

    it('only counts touches on the files the entry is about', () => {
        const touches = [
            touch(MANNY.email, 0, 'server/src/auth/tokens.ts'),
            touch(MANNY.email, 0, 'server/src/timeline/queries.ts')
        ];

        const [manny] = scoreTeammates(touches, [MANNY, GABBY], CONTEXT, NOW);

        expect(manny.last_touch?.file_path).toBe('server/src/auth/tokens.ts');
        expect(manny.signals.ownership).toBe(1);
    });

    // the denominator counts everyone, so a departed author's share stays missing rather than
    // -> being redistributed to whoever is left. Shares totalling under 1 is the honest answer.
    it('leaves a departed author out of the results but inside the denominator', () => {
        const touches = [...many(5, 'someone@wholeft.dev', 30), ...many(5, MANNY.email, 30)];

        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const scores = scoreTeammates(touches, [MANNY, GABBY], CONTEXT, NOW);
        warn.mockRestore();

        expect(scores).toHaveLength(2);
        expect(scores[0].signals.ownership).toBe(0.5);
    });

    // detect, do not prevent: an unresolvable author disappears from every score, and this is the
    // -> only place that still knows the address. Once, not once per commit.
    it('warns exactly once about an author the roster does not have', () => {
        const touches = many(50, 'someone@wholeft.dev', 1);

        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        scoreTeammates(touches, [MANNY, GABBY], CONTEXT, NOW);

        expect(warn).toHaveBeenCalledTimes(1);
        expect(warn.mock.calls[0][0]).toContain('someone@wholeft.dev');
        warn.mockRestore();
    });

    it('reports the newest touch, junk subject and all', () => {
        const touches = [
            touch(MANNY.email, 5, 'server/src/auth/tokens.ts', 'rewrite the refresh flow'),
            touch(MANNY.email, 1, 'server/src/auth/middleware.ts', 'wip')
        ];

        const [manny] = scoreTeammates(touches, [MANNY, GABBY], CONTEXT, NOW);

        // filtering "wip" is the reason generator's call, not this file's (ADR 0011).
        expect(manny.last_touch).toEqual({
            file_path: 'server/src/auth/middleware.ts',
            subject: 'wip',
            at: daysAgo(1)
        });
    });

    // Nothing in the types says a signal is 0..1, so this assertion is the only thing holding it.
    // Signals as well as the total, because a frequency of 1.5 only contributes 0.3 and hides
    // -> inside a passing score whenever the other two are low.
    // Only proves it for these inputs, which is why they sit at the edges: past the cap, far older
    // -> than the half-life, and future-dated. ADR 0015 covers what would close the rest.
    it('keeps every score and every signal inside zero and one', () => {
        const touches = [
            ...many(60, MANNY.email, 0),
            ...many(30, GABBY.email, 900),
            touch(GABBY.email, -30)
        ];

        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const scores = scoreTeammates(touches, [MANNY, GABBY], CONTEXT, NOW);
        warn.mockRestore();

        for (const s of scores) {
            for (const value of [s.score, ...Object.values(s.signals)]) {
                expect(value).toBeGreaterThanOrEqual(0);
                expect(value).toBeLessThanOrEqual(1);
            }
        }
    });

    it('scores everyone zero when nothing has ever touched these files', () => {
        const scores = scoreTeammates([], [MANNY, GABBY], CONTEXT, NOW);

        expect(scores.every((s) => s.score === 0)).toBe(true);
        expect(scores.every((s) => s.last_touch === null)).toBe(true);
    });
});
