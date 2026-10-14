/**
 * bubbleMath.test.ts — the endless-bubbles promise, held as numbers: however far you scroll or
 * however long it runs, every bubble stays inside the band just around the screen (so the field
 * never runs dry), nearer bubbles move more than far ones, and the cursor pushes bubbles away.
 */

import { describe, it, expect } from 'vitest';
import { MARGIN, bubbleCount, makeBubbles, position, repel, wrap } from './bubbleMath';

const screen = { width: 1440, height: 900, scrollY: 0, time: 0, px: 0, py: 0 };

describe('bubbleMath', () => {
    it('wraps negatives and overflows into the span', () => {
        expect(wrap(-10, 100)).toBe(90);
        expect(wrap(250, 100)).toBe(50);
        expect(wrap(0, 100)).toBe(0);
    });

    // the endless part: no amount of scrolling or time empties the screen
    it.each([0, 900, 25_000, 1_000_000])('keeps every bubble near the screen after scrolling %ipx', (scrollY) => {
        const bubbles = makeBubbles(60);
        for (const b of bubbles) {
            const { x, y } = position(b, { ...screen, scrollY, time: scrollY * 7 });
            expect(x).toBeGreaterThanOrEqual(-MARGIN);
            expect(x).toBeLessThan(screen.width + MARGIN);
            expect(y).toBeGreaterThanOrEqual(-MARGIN);
            expect(y).toBeLessThan(screen.height + MARGIN);
        }
    });

    it('keeps plenty of bubbles on screen deep into a scroll', () => {
        const bubbles = makeBubbles(bubbleCount(1440, 900));
        const visible = bubbles.filter((b) => {
            const { x, y } = position(b, { ...screen, scrollY: 48_000 });
            return x >= 0 && x <= 1440 && y >= 0 && y <= 900;
        });
        expect(visible.length).toBeGreaterThan(bubbles.length * 0.5);
    });

    it('moves nearer bubbles further than far ones for the same scroll (parallax)', () => {
        const [b] = makeBubbles(1);
        const near = { ...b!, depth: 1.2, x0: 0.5, y0: 0.5 };
        const far = { ...b!, depth: 0.3, x0: 0.5, y0: 0.5 };
        const moved = (bb: typeof near) => position(bb, screen).y - position(bb, { ...screen, scrollY: 100 }).y;
        expect(moved(near)).toBeGreaterThan(moved(far));
        expect(moved(far)).toBeGreaterThan(0);
    });

    it('leans the field away from the cursor', () => {
        const [b] = makeBubbles(1);
        const centered = { ...b!, x0: 0.5, y0: 0.5 };
        expect(position(centered, { ...screen, px: 1 }).x).toBeLessThan(position(centered, screen).x);
    });

    it('is deterministic, mostly small, and sized to the screen', () => {
        expect(makeBubbles(5, 3)).toEqual(makeBubbles(5, 3));
        const sizes = makeBubbles(200).map((b) => b.r);
        expect(sizes.filter((r) => r < 20).length).toBeGreaterThan(sizes.length * 0.6);
        expect(Math.max(...sizes)).toBeLessThanOrEqual(61);
        expect(bubbleCount(1440, 900)).toBe(54);
        expect(bubbleCount(320, 500)).toBe(16);
        expect(bubbleCount(5000, 5000)).toBe(90);
    });

    it('pushes bubbles away from the cursor inside its radius, not outside', () => {
        const near = repel(110, 100, 100, 100);
        expect(near.dx).toBeGreaterThan(0);
        expect(near.dy).toBe(0);
        expect(repel(400, 100, 100, 100)).toEqual({ dx: 0, dy: 0 });
        expect(repel(100, 100, 100, 100)).toEqual({ dx: 0, dy: 0 });
    });
});
