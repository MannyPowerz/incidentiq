/**
 * bubbleMath — the math behind the endless bubbles, kept free of the canvas so it can be tested.
 *
 * Every bubble has a fixed home (x0, y0 as fractions of the screen), a size, and a depth. Its
 * position on screen is a function of time, scroll and cursor: deeper bubbles move more (parallax),
 * and every coordinate wraps around a band slightly larger than the screen. That wrap is what makes
 * the field endless: a bubble that leaves the top comes back in at the bottom, so scrolling never
 * runs out of bubbles and none ever pops into view mid-screen.
 */

export type Bubble = {
    x0: number;
    y0: number;
    // radius in CSS pixels; most are small, a few are large
    r: number;
    // 0.25 (far, slow) to 1.25 (near, fast)
    depth: number;
    // how fast it rises on its own, and where it sits in its side-to-side sway
    drift: number;
    phase: number;
    // which mesh color tints its rim
    hue: 0 | 1 | 2 | 3;
};

export type Frame = {
    width: number;
    height: number;
    scrollY: number;
    // milliseconds
    time: number;
    // -1..1 like the pointer field
    px: number;
    py: number;
};

// how far past the screen edge a bubble travels before it wraps, so big ones never pop in
export const MARGIN = 90;

// deterministic, so the same screen always gets the same bubbles (and tests can pin them)
function mulberry32(seed: number): () => number {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// one bubble per this many square pixels: dense enough to feel endless, sparse enough to stay calm
const AREA_PER_BUBBLE = 24000;

export function bubbleCount(width: number, height: number, density = 1): number {
    return Math.max(16, Math.min(90, Math.round(((width * height) / AREA_PER_BUBBLE) * density)));
}

export function makeBubbles(count: number, seed = 7): Bubble[] {
    const rand = mulberry32(seed);
    return Array.from({ length: count }, () => {
        const size = rand();
        return {
            x0: rand(),
            y0: rand(),
            // skewed toward small: size^2.6 keeps big bubbles rare
            r: 3 + 58 * size ** 2.6,
            depth: 0.25 + rand(),
            drift: 0.4 + rand() * 0.8,
            phase: rand() * Math.PI * 2,
            hue: Math.floor(rand() * 4) as Bubble['hue'],
        };
    });
}

// always in [0, span), for negative values too
export const wrap = (value: number, span: number): number => ((value % span) + span) % span;

export function position(b: Bubble, f: Frame): { x: number; y: number } {
    const spanX = f.width + MARGIN * 2;
    const spanY = f.height + MARGIN * 2;
    // scrolling down moves bubbles up, nearer ones faster; time adds a slow rise of their own
    const rise = f.scrollY * b.depth * 0.55 + f.time * 0.012 * b.drift;
    const sway = Math.sin(f.time * 0.00035 * b.drift + b.phase) * 18 * b.depth;
    // the cursor pulls the field gently the other way, more for nearer bubbles
    const leanX = -f.px * 34 * b.depth;
    const leanY = -f.py * 24 * b.depth;
    return {
        x: wrap(b.x0 * spanX + sway + leanX, spanX) - MARGIN,
        y: wrap(b.y0 * spanY - rise + leanY, spanY) - MARGIN,
    };
}

/**
 * Bubbles near the cursor drift away from it, strongest at the center and fading to nothing at
 * `radius`. Returns the offset to add to a bubble's position.
 */
export function repel(x: number, y: number, cx: number, cy: number, radius = 150): { dx: number; dy: number } {
    const dx = x - cx;
    const dy = y - cy;
    const dist = Math.hypot(dx, dy);
    if (dist >= radius || dist === 0) return { dx: 0, dy: 0 };
    const push = (1 - dist / radius) ** 2 * 38;
    return { dx: (dx / dist) * push, dy: (dy / dist) * push };
}
