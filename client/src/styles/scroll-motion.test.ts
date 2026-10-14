/**
 * scroll-motion.test.ts — every scroll-driven animation in the app stylesheet must sit inside both
 * guards: support for scroll timelines (else everything stays still) and no reduced-motion
 * preference. CSS cannot be run in jsdom, so this holds the stylesheet's structure instead.
 */

import { describe, it, expect } from 'vitest';
import css from './utilities.css?raw';

// index just past the brace that closes the block opening at `start`
function blockEnd(text: string, start: number): number {
    let depth = 0;
    for (let i = text.indexOf('{', start); i < text.length; i++) {
        if (text[i] === '{') depth++;
        else if (text[i] === '}' && --depth === 0) return i + 1;
    }
    throw new Error('unclosed block');
}

describe('scroll motion guards', () => {
    const supportsAt = css.indexOf('@supports (animation-timeline: view())');
    const reducedAt = css.indexOf('@media (prefers-reduced-motion: no-preference)', supportsAt);
    // declarations end in ';', which tells them apart from the @supports condition naming the same property
    const declarations = [...css.matchAll(/animation-timeline:[^;{}()]*(?:\([^)]*\))?;/g)].map((m) => m.index!);

    it('has both guards, nested in that order', () => {
        expect(supportsAt).toBeGreaterThan(-1);
        expect(reducedAt).toBeGreaterThan(supportsAt);
        expect(reducedAt).toBeLessThan(blockEnd(css, supportsAt));
    });

    it('declares every scroll timeline inside both guards', () => {
        expect(declarations.length).toBeGreaterThan(0);
        const end = blockEnd(css, reducedAt);
        for (const at of declarations) {
            expect(at).toBeGreaterThan(reducedAt);
            expect(at).toBeLessThan(end);
        }
    });
});
