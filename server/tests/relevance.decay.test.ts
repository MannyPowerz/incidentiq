/**
 * relevance.decay.test.ts — the decay curve, asserted at exact values.
 *
 * Exact rather than approximate is the whole payoff of decayWeight taking `now` as a parameter.
 * If it read Date.now() itself every case here would be "roughly a half" and a real drift could
 * hide inside the tolerance.
 */

import { describe, expect, it } from 'vitest';
import { decayWeight } from '../src/relevance/decay.js';
import { RELEVANCE_HALF_LIFE_DAYS } from '../src/relevance/constants.js';

const NOW = new Date('2026-08-11T12:00:00Z');
const MS_PER_DAY = 1000 * 60 * 60 * 24;

const daysAgo = (days: number) => new Date(NOW.getTime() - days * MS_PER_DAY);

describe('decayWeight', () => {
    it('gives a commit made right now the full weight', () => {
        expect(decayWeight(NOW, NOW)).toBe(1);
    });

    // the definition of a half-life, so this is the one that would catch a wrong formula.
    it('halves at the half-life and again at twice it', () => {
        expect(decayWeight(daysAgo(RELEVANCE_HALF_LIFE_DAYS), NOW)).toBe(0.5);
        expect(decayWeight(daysAgo(RELEVANCE_HALF_LIFE_DAYS * 2), NOW)).toBe(0.25);
        expect(decayWeight(daysAgo(RELEVANCE_HALF_LIFE_DAYS * 3), NOW)).toBe(0.125);
    });

    it('fades toward zero without ever reaching it', () => {
        const ancient = decayWeight(daysAgo(365), NOW);
        expect(ancient).toBeGreaterThan(0);
        expect(ancient).toBeLessThan(0.001);
    });

    // no cutoff: the whole reason for exponential decay is that nothing falls off a cliff.
    it('never jumps between adjacent days', () => {
        for (let d = 0; d < 60; d++) {
            const today = decayWeight(daysAgo(d), NOW);
            const tomorrow = decayWeight(daysAgo(d + 1), NOW);
            expect(tomorrow).toBeLessThan(today);
            expect(today - tomorrow).toBeLessThan(0.05);
        }
    });

    // a broken clock must not be able to outweigh real work. Without the guard the weight would
    // -> exceed 1 here, and one bad commit would beat every legitimate one combined.
    it('scores a future-dated commit zero rather than above one', () => {
        expect(decayWeight(daysAgo(-1), NOW)).toBe(0);
        expect(decayWeight(daysAgo(-365), NOW)).toBe(0);
    });

    it('stays within 0 and 1 across a wide range of ages', () => {
        for (const d of [-100, -1, 0, 1, 14, 90, 1000]) {
            const w = decayWeight(daysAgo(d), NOW);
            expect(w).toBeGreaterThanOrEqual(0);
            expect(w).toBeLessThanOrEqual(1);
        }
    });
});
