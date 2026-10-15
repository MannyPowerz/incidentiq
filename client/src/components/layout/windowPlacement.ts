/**
 * windowPlacement — where the background windows go, decided from the page itself.
 *
 * Each window tries many random spots and keeps the one that covers the least of the page's
 * content and of the windows already placed. So the windows land in whatever empty space this
 * page has: the margins of a list, the space beside a form, below a short page. They land
 * somewhere new every time, because each arrangement draws from its own seed.
 *
 * Pure, so it is tested without a DOM. IdeBackdrop measures the page and applies the result.
 */

export type Rect = { x: number; y: number; w: number; h: number };
export type Size = { w: number; h: number };

export type PlaceOptions = {
    // the clear band at the top (the top bar) and the gap kept from every other edge, in px
    top: number;
    gap: number;
    // spots tried per window: more finds better gaps and costs more time
    tries: number;
};

const DEFAULTS: PlaceOptions = { top: 80, gap: 16, tries: 48 };

// overlapping a window costs more than overlapping content: a window covering a window looks broken
const WINDOW_WEIGHT = 3;

// deterministic, so an arrangement can be replayed and tested
export function seeded(seed: number): () => number {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

export function overlap(a: Rect, b: Rect): number {
    const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
    const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
    return w > 0 && h > 0 ? w * h : 0;
}

/** One rect per size, inside the view, each placed where it covers the least content and the fewest windows. */
export function placeWindows(view: Size, sizes: Size[], keepOut: Rect[], rand: () => number, options: Partial<PlaceOptions> = {}): Rect[] {
    const { top, gap, tries } = { ...DEFAULTS, ...options };
    const placed: Rect[] = [];
    for (const size of sizes) {
        // the range a window can start in; a window bigger than the view is pinned to the gap
        const maxX = Math.max(gap, view.w - size.w - gap);
        const maxY = Math.max(top, view.h - size.h - gap);
        let best: Rect | null = null;
        let bestCost = Infinity;
        for (let i = 0; i < tries; i++) {
            const spot = { x: Math.round(gap + rand() * (maxX - gap)), y: Math.round(top + rand() * (maxY - top)), ...size };
            let cost = 0;
            for (const k of keepOut) cost += overlap(spot, k);
            for (const p of placed) cost += overlap(spot, p) * WINDOW_WEIGHT;
            if (cost < bestCost) {
                best = spot;
                bestCost = cost;
                // a spot that covers nothing cannot be beaten
                if (cost === 0) break;
            }
        }
        placed.push(best!);
    }
    return placed;
}
