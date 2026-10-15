/**
 * CodeTrace.test.tsx — the panes type on their own, faster when you type or move the cursor, never
 * show what you typed, print a step of the loop where you click, move on to a new story and spot
 * when one finishes, and hold still under reduced motion.
 */

import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { act, fireEvent, render } from '@testing-library/react';
import CodeTrace, { ECHOES, MOVE_PX, TICK_MS } from './CodeTrace';
import { STORIES, lifetime, storyLength } from './traceScript';

const first = STORIES[0]!;
const firstLine = first.lines[0]!.text;

// the text of the first pane's lines
function lines(container: HTMLElement): string[] {
    const pane = container.querySelector('.trace__pane');
    return pane ? [...pane.querySelectorAll('.trace__line')].map((l) => l.textContent ?? '') : [];
}

const tick = (n: number) => act(() => vi.advanceTimersByTime(TICK_MS * n));

describe('CodeTrace', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
    });

    it('is decoration, hidden from assistive tech', () => {
        const { container } = render(<CodeTrace />);
        expect(container.firstElementChild!.getAttribute('aria-hidden')).toBe('true');
    });

    it('types on its own, a character per tick, and staggers the other panes', () => {
        const { container } = render(<CodeTrace panes={3} />);
        tick(4);
        expect(lines(container)).toEqual([firstLine.slice(0, 4)]);
        // the second and third panes have not started yet
        expect(container.querySelectorAll('.trace__pane')).toHaveLength(1);
    });

    it('types faster while you type, and never shows the keys you pressed', () => {
        const { container } = render(<CodeTrace panes={1} />);
        tick(1);
        for (const key of 'zq') fireEvent.keyDown(window, { key });
        expect(lines(container)).toEqual([firstLine.slice(0, 1 + 3 + 3)]);
        expect(container.textContent).not.toContain('zq');
    });

    it('types as the cursor travels', () => {
        const { container } = render(<CodeTrace panes={1} />);
        tick(1);
        fireEvent.pointerMove(window, { clientX: 0, clientY: 0 });
        fireEvent.pointerMove(window, { clientX: MOVE_PX * 2, clientY: 0 });
        expect(lines(container)).toEqual([firstLine.slice(0, 3)]);
        // the travel already spent does not count again
        fireEvent.pointerMove(window, { clientX: MOVE_PX * 2 + 4, clientY: 0 });
        expect(lines(container)).toEqual([firstLine.slice(0, 3)]);
    });

    it('prints a step of the loop where you click, at most three at a time, each gone after a moment', () => {
        const { container } = render(<CodeTrace panes={1} />);
        for (let i = 0; i < 4; i++) fireEvent.pointerDown(window, { clientX: 40, clientY: 60 });
        const echoes = container.querySelectorAll<HTMLElement>('.trace__echo');
        expect(echoes).toHaveLength(3);
        expect(ECHOES).toContain(echoes[0]!.textContent);
        expect([echoes[0]!.style.left, echoes[0]!.style.top]).toEqual(['40px', '60px']);
        act(() => vi.advanceTimersByTime(1800));
        expect(container.querySelectorAll('.trace__echo')).toHaveLength(0);
    });

    it('finishes its story, fades, and comes back with another story somewhere else', () => {
        const { container } = render(<CodeTrace panes={1} />);
        tick(storyLength(first));
        expect(lines(container).at(-1)).toBe(first.lines.at(-1)!.text);
        const before = (container.querySelector('.trace__pane') as HTMLElement).style.left;

        tick(lifetime(first) - storyLength(first) - 1);
        expect(container.querySelector('.trace__pane')!.classList.contains('is-leaving')).toBe(true);

        tick(1);
        const pane = container.querySelector('.trace__pane') as HTMLElement;
        expect(pane.textContent).toContain(STORIES[1]!.title);
        expect(pane.style.left).not.toBe(before);
    });

    it('never puts two panes in the same spot, story after story', () => {
        const { container } = render(<CodeTrace panes={3} />);
        for (let i = 0; i < 900; i++) {
            tick(1);
            const spots = [...container.querySelectorAll<HTMLElement>('.trace__pane')].map((p) => `${p.style.left},${p.style.top}`);
            expect(new Set(spots).size).toBe(spots.length);
        }
    });

    it('under reduced motion shows every finished story and does not move', () => {
        vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduce'), addEventListener() {}, removeEventListener() {} }));
        const { container } = render(<CodeTrace panes={2} />);
        const panes = container.querySelectorAll('.trace__pane');
        expect(panes).toHaveLength(2);
        expect(lines(container)).toEqual(first.lines.map((l) => l.text));
        const shown = container.textContent;
        tick(50);
        fireEvent.keyDown(window, { key: 'a' });
        expect(container.textContent).toBe(shown);
    });
});
