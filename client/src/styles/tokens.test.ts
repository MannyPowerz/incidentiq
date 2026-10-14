/**
 * tokens.test.ts — "contrast is not optional," enforced.
 *
 * Reads tokens.css off disk, resolves every semantic alias down to its hex, and asserts WCAG AA for
 * each text/background pair a screen can produce. Changing a color in tokens.css is allowed; making
 * one unreadable is not, and this is what says so. The last case composites the glass tint over the
 * brightest mesh color, because a floating layer has to be checked against the busiest background it
 * can land on, not a convenient one.
 */

import { describe, it, expect } from 'vitest';
// Vite's ?raw gives the file as a string, so the test needs no node types the app tsconfig lacks
import css from './tokens.css?raw';

type RGB = [number, number, number];

const raw = new Map<string, string>();
for (const m of css.matchAll(/(--[a-z0-9-]+):\s*([^;]+);/g)) raw.set(m[1]!, m[2]!.trim());

function resolveToken(name: string, depth = 0): string {
    const v = raw.get(name);
    if (!v) throw new Error(`token ${name} not found`);
    const ref = v.match(/^var\((--[a-z0-9-]+)\)$/);
    if (ref) {
        if (depth > 5) throw new Error(`alias loop at ${name}`);
        return resolveToken(ref[1]!, depth + 1);
    }
    return v;
}

function hexToRgb(hex: string): RGB {
    const h = hex.replace('#', '');
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function rgbaToRgbA(s: string): [RGB, number] {
    const m = s.match(/rgba?\(\s*(\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\s*\)/);
    if (!m) throw new Error(`not rgba: ${s}`);
    return [[+m[1]!, +m[2]!, +m[3]!], m[4] === undefined ? 1 : +m[4]];
}

function luminance([r, g, b]: RGB): number {
    const f = (c: number) => {
        const s = c / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function ratio(a: RGB, b: RGB): number {
    const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
    return (l1 + 0.05) / (l2 + 0.05);
}

const rgb = (token: string): RGB => hexToRgb(resolveToken(token));

// alpha-composites `top` (with alpha) over `under`
function over(top: RGB, alpha: number, under: RGB): RGB {
    return top.map((c, i) => Math.round(c * alpha + under[i]! * (1 - alpha))) as RGB;
}

const AA_TEXT = 4.5;
const AA_UI = 3;

describe('tokens.css contrast (WCAG AA)', () => {
    const surfaces = ['--color-bg', '--color-surface', '--color-surface-2', '--color-field-bg'];

    it.each(surfaces)('body text reads on %s', (bg) => {
        expect(ratio(rgb('--color-text'), rgb(bg))).toBeGreaterThanOrEqual(AA_TEXT);
    });

    it.each(surfaces)('secondary text reads on %s', (bg) => {
        expect(ratio(rgb('--color-text-2'), rgb(bg))).toBeGreaterThanOrEqual(AA_TEXT);
    });

    // the muted tone is the one most likely to drift under the line, so every surface is checked
    it.each(surfaces)('muted text reads on %s', (bg) => {
        expect(ratio(rgb('--color-text-3'), rgb(bg))).toBeGreaterThanOrEqual(AA_TEXT);
    });

    it('brand orange works as link text on the surface', () => {
        expect(ratio(rgb('--color-primary'), rgb('--color-surface'))).toBeGreaterThanOrEqual(AA_TEXT);
        expect(ratio(rgb('--color-primary-strong'), rgb('--color-surface'))).toBeGreaterThanOrEqual(AA_TEXT);
    });

    it('button text reads on the primary and danger fills', () => {
        expect(ratio(rgb('--color-on-primary'), rgb('--color-primary'))).toBeGreaterThanOrEqual(AA_TEXT);
        expect(ratio(rgb('--color-on-primary'), rgb('--color-danger'))).toBeGreaterThanOrEqual(AA_TEXT);
    });

    // badge text sits on a 16% tint of itself over the surface; the surface is the worst case
    it.each(['--sev-p1', '--sev-p2', '--sev-p3', '--sev-p4', '--status-resolved', '--status-postmortem', '--color-danger', '--color-success'])(
        '%s reads as badge or state text on the surface',
        (token) => {
            expect(ratio(rgb(token), rgb('--color-surface'))).toBeGreaterThanOrEqual(AA_TEXT);
        },
    );

    it('control borders and the focus ring hit 3:1 against what they sit on', () => {
        expect(ratio(rgb('--color-border-strong'), rgb('--color-field-bg'))).toBeGreaterThanOrEqual(AA_UI);
        expect(ratio(rgb('--color-focus'), rgb('--color-bg'))).toBeGreaterThanOrEqual(AA_UI);
        expect(ratio(rgb('--color-focus'), rgb('--color-surface'))).toBeGreaterThanOrEqual(AA_UI);
    });

    it('pure white is the brightest text, reserved for data', () => {
        expect(luminance(rgb('--color-data'))).toBeGreaterThan(luminance(rgb('--color-text')));
    });

    // the HIG rule: check glass against the busiest background it can land on, not a convenient one
    it('text on a glass layer over the brightest mesh color still reads', () => {
        const [tint, alpha] = rgbaToRgbA(resolveToken('--glass-bg'));
        const worstUnder = rgb('--mesh-2');
        const composite = over(tint, alpha, worstUnder);
        expect(ratio(rgb('--color-text'), composite)).toBeGreaterThanOrEqual(AA_TEXT);
        // .ui-glass promotes muted text to this tone; that promotion is what this line protects
        expect(ratio(rgb('--color-text-2'), composite)).toBeGreaterThanOrEqual(AA_TEXT);
    });
});
