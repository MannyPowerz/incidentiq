/**
 * traceScript.test.ts — code and commands type out a character at a time, everything else lands
 * whole after a beat, and every story plays the product's loop: flagged, fixed, then green.
 */

import { describe, it, expect } from 'vitest';
import { BEAT, FADE, HOLD, STORIES, lifetime, reveal, storyLength } from './traceScript';
import type { Story } from './traceScript';

const story: Story = {
    pane: 'editor',
    title: 't.ts',
    lines: [
        { text: 'abc', kind: 'code' },
        { text: 'boom', kind: 'flag' },
        { text: 'fixed', kind: 'ok' },
    ],
};

describe('reveal', () => {
    it('shows nothing before the story starts', () => {
        expect(reveal(story, 0)).toEqual([]);
        expect(reveal(story, -5)).toEqual([]);
    });

    it('types code a character per tick, with the caret on the line being typed', () => {
        expect(reveal(story, 2)).toEqual([{ text: 'ab', kind: 'code', typing: true }]);
        expect(reveal(story, 3)).toEqual([{ text: 'abc', kind: 'code', typing: false }]);
    });

    it('lands a flag whole after a beat, never partly', () => {
        expect(reveal(story, 3 + BEAT - 1)).toHaveLength(1);
        expect(reveal(story, 3 + BEAT)[1]).toEqual({ text: 'boom', kind: 'flag', typing: false });
    });

    it('shows the whole story, nothing typing, once its length has passed', () => {
        const all = reveal(story, storyLength(story));
        expect(all.map((l) => l.text)).toEqual(['abc', 'boom', 'fixed']);
        expect(all.some((l) => l.typing)).toBe(false);
        expect(storyLength(story)).toBe(3 + BEAT + BEAT);
    });

    it('lives for its length, then the hold, then the fade', () => {
        expect(lifetime(story)).toBe(storyLength(story) + HOLD + FADE);
    });
});

describe('STORIES', () => {
    it('each plays the loop: something is flagged, then fixed, and it ends green', () => {
        for (const s of STORIES) {
            const kinds = s.lines.map((l) => l.kind);
            expect(kinds.indexOf('flag')).toBeGreaterThan(-1);
            expect(kinds.lastIndexOf('flag')).toBeLessThan(kinds.lastIndexOf('ok'));
            expect(kinds.at(-1)).toBe('ok');
        }
    });

    it('has a fix as a diff in every editor story', () => {
        for (const s of STORIES.filter((x) => x.pane === 'editor')) {
            const kinds = s.lines.map((l) => l.kind);
            expect(kinds.indexOf('del')).toBeGreaterThan(kinds.indexOf('flag'));
            expect(kinds.indexOf('add')).toBeGreaterThan(kinds.indexOf('del'));
        }
    });
});
