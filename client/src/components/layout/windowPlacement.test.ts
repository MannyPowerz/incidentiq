/**
 * windowPlacement.test.ts — windows stay on screen, avoid the page's content and each other when
 * there is room, settle for the least-covering spot when there is not, and vary from seed to seed.
 */

import { describe, it, expect } from 'vitest';
import { overlap, placeWindows, seeded } from './windowPlacement';
import type { Rect } from './windowPlacement';

const VIEW = { w: 1440, h: 900 };
const SIZES = [
    { w: 460, h: 264 },
    { w: 400, h: 184 },
    { w: 256, h: 136 },
];
// a page with its text down the left and a list across the middle
const CONTENT: Rect[] = [
    { x: 150, y: 90, w: 600, h: 200 },
    { x: 150, y: 320, w: 1140, h: 260 },
];

describe('overlap', () => {
    it('is the shared area, and zero for rects that only touch or miss', () => {
        expect(overlap({ x: 0, y: 0, w: 10, h: 10 }, { x: 5, y: 5, w: 10, h: 10 })).toBe(25);
        expect(overlap({ x: 0, y: 0, w: 10, h: 10 }, { x: 10, y: 0, w: 10, h: 10 })).toBe(0);
        expect(overlap({ x: 0, y: 0, w: 10, h: 10 }, { x: 50, y: 50, w: 10, h: 10 })).toBe(0);
    });
});

describe('placeWindows', () => {
    it('keeps every window inside the view, below the top bar', () => {
        for (let seed = 1; seed <= 20; seed++) {
            for (const r of placeWindows(VIEW, SIZES, CONTENT, seeded(seed), { top: 80, gap: 16 })) {
                expect(r.x).toBeGreaterThanOrEqual(16);
                expect(r.y).toBeGreaterThanOrEqual(80);
                expect(r.x + r.w).toBeLessThanOrEqual(VIEW.w - 16);
                expect(r.y + r.h).toBeLessThanOrEqual(VIEW.h - 16);
            }
        }
    });

    it('covers no content and no other window when the page leaves room', () => {
        for (let seed = 1; seed <= 20; seed++) {
            const rects = placeWindows(VIEW, SIZES, CONTENT, seeded(seed), { tries: 200 });
            for (const [i, r] of rects.entries()) {
                for (const c of CONTENT) expect(overlap(r, c)).toBe(0);
                for (const other of rects.slice(i + 1)) expect(overlap(r, other)).toBe(0);
            }
        }
    });

    it('takes the least-covering spot when nothing is free', () => {
        // content everywhere except a strip on the right; the window must lean into the strip
        const crowded: Rect[] = [{ x: 0, y: 0, w: 1100, h: 900 }];
        const [r] = placeWindows(VIEW, [{ w: 400, h: 200 }], crowded, seeded(3), { tries: 400 });
        expect(r!.x).toBeGreaterThan(900);
    });

    it('lands somewhere different from one arrangement to the next', () => {
        const spots = new Set(
            Array.from({ length: 10 }, (_, seed) => {
                const [r] = placeWindows(VIEW, SIZES, CONTENT, seeded(seed + 1));
                return `${r!.x},${r!.y}`;
            }),
        );
        expect(spots.size).toBeGreaterThan(5);
    });

    it('pins a window bigger than the view to the gap instead of pushing it off screen', () => {
        const [r] = placeWindows({ w: 300, h: 200 }, [{ w: 500, h: 400 }], [], seeded(1), { top: 10, gap: 8 });
        expect([r!.x, r!.y]).toEqual([8, 10]);
    });
});
