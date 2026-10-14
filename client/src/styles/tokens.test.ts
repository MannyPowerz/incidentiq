/**
 * tokens.test.ts — "contrast is not optional," enforced, for both themes.
 *
 * Reads tokens.css, builds each theme's palette (dark is the base :root block; light is the base
 * with the :root[data-theme="light"] block applied on top), resolves every semantic alias to its
 * color, and holds each text/background pair a screen can produce at WCAG AA. Changing a color is
 * allowed; making one unreadable in either theme is not. Glass and the ambient mesh are checked
 * against their busiest backgrounds, not a convenient one.
 */

import { describe, it, expect } from 'vitest';
// Vite's ?raw gives the file as a string, so the test needs no node types the app tsconfig lacks
import css from './tokens.css?raw';

type RGB = [number, number, number];
type Palette = Map<string, string>;

// the declarations inside the block that opens at `selector {`, up to its closing brace
function block(selector: string): string {
    const start = css.indexOf(`${selector} {`);
    if (start === -1) throw new Error(`no ${selector} block in tokens.css`);
    const open = css.indexOf('{', start);
    return css.slice(open + 1, css.indexOf('\n}', open));
}

function declarations(text: string): Palette {
    const map: Palette = new Map();
    for (const m of text.matchAll(/(--[a-z0-9-]+):\s*([^;]+);/g)) map.set(m[1]!, m[2]!.trim());
    return map;
}

const dark = declarations(block(':root'));
const light = new Map([...dark, ...declarations(block(':root[data-theme="light"]'))]);

function resolve(palette: Palette, name: string, depth = 0): string {
    const v = palette.get(name);
    if (!v) throw new Error(`token ${name} not found`);
    const ref = v.match(/^var\((--[a-z0-9-]+)\)$/);
    if (ref) {
        if (depth > 5) throw new Error(`alias loop at ${name}`);
        return resolve(palette, ref[1]!, depth + 1);
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

// alpha-composites `top` (with alpha) over `under`
function over(top: RGB, alpha: number, under: RGB): RGB {
    return top.map((c, i) => Math.round(c * alpha + under[i]! * (1 - alpha))) as RGB;
}

const AA_TEXT = 4.5;
const AA_UI = 3;
const SURFACES = ['--color-bg', '--color-surface', '--color-surface-2', '--color-field-bg'];
const MESH = ['--mesh-1', '--mesh-2', '--mesh-3'];

describe.each([
    ['dark', dark],
    ['light', light],
] as const)('tokens.css contrast, %s theme (WCAG AA)', (_theme, palette) => {
    const rgb = (token: string): RGB => hexToRgb(resolve(palette, token));

    it.each(SURFACES)('body text reads on %s', (bg) => {
        expect(ratio(rgb('--color-text'), rgb(bg))).toBeGreaterThanOrEqual(AA_TEXT);
    });

    it.each(SURFACES)('secondary text reads on %s', (bg) => {
        expect(ratio(rgb('--color-text-2'), rgb(bg))).toBeGreaterThanOrEqual(AA_TEXT);
    });

    // the muted tone is the one most likely to drift under the line, so every surface is checked
    it.each(SURFACES)('muted text reads on %s', (bg) => {
        expect(ratio(rgb('--color-text-3'), rgb(bg))).toBeGreaterThanOrEqual(AA_TEXT);
    });

    // orange as text (links, eyebrows) is always the strong orange; the base orange is a fill only
    it.each(SURFACES)('orange text reads on %s', (bg) => {
        expect(ratio(rgb('--color-primary-strong'), rgb(bg))).toBeGreaterThanOrEqual(AA_TEXT);
    });

    it('button text reads on every fill it sits on, including hover', () => {
        expect(ratio(rgb('--color-on-primary'), rgb('--color-primary'))).toBeGreaterThanOrEqual(AA_TEXT);
        expect(ratio(rgb('--color-on-primary'), rgb('--color-primary-hover'))).toBeGreaterThanOrEqual(AA_TEXT);
        expect(ratio(rgb('--color-on-danger'), rgb('--color-danger'))).toBeGreaterThanOrEqual(AA_TEXT);
    });

    // badge text sits on a light tint of itself over the surface; the bare surface is the check
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

    // white in dark mode, near-black in light: either way data out-contrasts body text
    it('data is the highest-contrast text, so live numbers lead', () => {
        expect(ratio(rgb('--color-data'), rgb('--color-surface'))).toBeGreaterThan(ratio(rgb('--color-text'), rgb('--color-surface')));
    });

    // the HIG rule: check glass against the busiest background it can land on, not a convenient one
    it.each(MESH)('text on a glass layer over %s still reads', (mesh) => {
        const [tint, alpha] = rgbaToRgbA(resolve(palette, '--glass-bg'));
        const composite = over(tint, alpha, rgb(mesh));
        expect(ratio(rgb('--color-text'), composite)).toBeGreaterThanOrEqual(AA_TEXT);
        // .ui-glass promotes muted text to this tone; that promotion is what this line protects
        expect(ratio(rgb('--color-text-2'), composite)).toBeGreaterThanOrEqual(AA_TEXT);
    });

    // one liquid-glass droplet at its brightest point: the tint over the mesh color, the glossy highlight over that
    const droplet = (mesh: string): RGB => {
        const [tint, tintA] = rgbaToRgbA(resolve(palette, '--liquid-tint'));
        const [shine, shineA] = rgbaToRgbA(resolve(palette, '--liquid-highlight'));
        return over(shine, shineA, over(tint, tintA, rgb(mesh)));
    };
    const backdropAt = (mesh: string, opacityToken: string): RGB =>
        over(droplet(mesh), Number(resolve(palette, opacityToken)), rgb('--color-bg'));

    // app pages: subtle backdrop, and page text down to the muted tone sits straight on it
    it.each(MESH)('muted text reads over the subtle backdrop at a %s droplet highlight', (mesh) => {
        expect(ratio(rgb('--color-text-3'), backdropAt(mesh, '--ambient-opacity'))).toBeGreaterThanOrEqual(AA_TEXT);
    });

    // landing and sign-in panel: bold backdrop, so text on it must be secondary or stronger
    it.each(MESH)('secondary text reads over the full backdrop at a %s droplet highlight', (mesh) => {
        expect(ratio(rgb('--color-text-2'), backdropAt(mesh, '--backdrop-full-opacity'))).toBeGreaterThanOrEqual(AA_TEXT);
        expect(ratio(rgb('--color-text'), backdropAt(mesh, '--backdrop-full-opacity'))).toBeGreaterThanOrEqual(AA_TEXT);
    });
});

// guards the guard: if the light block stops parsing, light would silently test as dark
describe('tokens.css themes', () => {
    it('defines a light palette that actually differs from dark', () => {
        expect(resolve(light, '--color-bg')).not.toBe(resolve(dark, '--color-bg'));
        expect(resolve(light, '--color-text')).not.toBe(resolve(dark, '--color-text'));
    });
});
