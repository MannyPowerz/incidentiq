/**
 * IdeBackdrop.test.tsx — it works by itself from the first frame; your cursor, scrolling, keys and
 * clicks drive it instead and pause the autopilot until you have been idle for IDLE_MS; the windows
 * rearrange per task, measured off the page so they keep clear of its content, and the one in use
 * comes forward; it never shows what you typed; and reduced
 * motion is one still picture.
 */

import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { act, fireEvent, render } from '@testing-library/react';
import IdeBackdrop, { AUTO_MS, CLICK_STEPS, EDITOR_LINES, IDLE_MS, KEY_STEPS, LAYOUTS, MOVE_PX, SCROLL_PX, SETTLE_MS, STILL_STEPS } from './IdeBackdrop';
import { overlap } from './windowPlacement';
import { initialState, step, stepN } from './ideScript';

// the script opens vite.config.ts in one step, then types `npm run dev` into the terminal
const CMD = 'npm run dev';
const typed = (steps: number) => CMD.slice(0, steps - 1);
const terminal = (c: HTMLElement) => c.querySelector('.ide__term:last-of-type')?.textContent ?? '';
const wait = (ms: number) => act(() => vi.advanceTimersByTime(ms));

describe('IdeBackdrop', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it('is decoration, hidden from assistive tech, showing the open file', () => {
        const { container } = render(<IdeBackdrop />);
        expect(container.firstElementChild!.getAttribute('aria-hidden')).toBe('true');
        expect(container.querySelector('.ide__tab.is-open')!.textContent).toBe('vite.config.ts');
        expect(container.querySelectorAll('.ide__line')).toHaveLength(EDITOR_LINES);
    });

    it('works by itself from the first frame', () => {
        const { container } = render(<IdeBackdrop />);
        wait(AUTO_MS * 4);
        expect(terminal(container)).toBe(typed(4));
    });

    it('lets your keys drive, pauses the autopilot, and resumes it after you go idle', () => {
        const { container } = render(<IdeBackdrop />);
        wait(AUTO_MS);
        fireEvent.keyDown(window, { key: 'z' });
        expect(terminal(container)).toBe(typed(1 + KEY_STEPS));

        wait(IDLE_MS - AUTO_MS * 2);
        expect(terminal(container)).toBe(typed(1 + KEY_STEPS));

        wait(AUTO_MS * 4);
        expect(terminal(container).length).toBeGreaterThan(typed(1 + KEY_STEPS).length);
    });

    it('never shows the keys you pressed', () => {
        const { container } = render(<IdeBackdrop />);
        for (const key of 'qjx') fireEvent.keyDown(window, { key });
        expect(container.textContent).not.toContain('qjx');
    });

    it('works as the cursor travels, without counting the same distance twice', () => {
        const { container } = render(<IdeBackdrop />);
        fireEvent.pointerMove(window, { clientX: 0, clientY: 0 });
        fireEvent.pointerMove(window, { clientX: MOVE_PX * 3, clientY: 0 });
        expect(terminal(container)).toBe(typed(3));
        fireEvent.pointerMove(window, { clientX: MOVE_PX * 3 + 2, clientY: 0 });
        expect(terminal(container)).toBe(typed(3));
    });

    it('works as you scroll and click', () => {
        const { container } = render(<IdeBackdrop />);
        vi.stubGlobal('scrollY', SCROLL_PX * 2);
        fireEvent.scroll(window);
        expect(terminal(container)).toBe(typed(2));
        // the distance already spent does not count again
        vi.stubGlobal('scrollY', SCROLL_PX * 2 + 3);
        fireEvent.scroll(window);
        expect(terminal(container)).toBe(typed(2));
        fireEvent.pointerDown(window);
        expect(terminal(container)).toBe(typed(2 + CLICK_STEPS));
    });

    it('rearranges its windows at each new task, like someone moving windows on a desktop', () => {
        const { container } = render(<IdeBackdrop />);
        const editor = () => container.querySelector<HTMLElement>('.ide-win--editor')!;
        expect(editor().style.getPropertyValue('--x')).toBe(`${LAYOUTS[0]!.editor.left}%`);
        let s = initialState();
        let n = 0;
        while (s.layout === 0) {
            s = step(s);
            n++;
        }
        wait(AUTO_MS * n);
        expect(editor().style.getPropertyValue('--x')).toBe(`${LAYOUTS[1]!.editor.left}%`);
        expect(editor().style.getPropertyValue('--y')).toBe(`${LAYOUTS[1]!.editor.top}%`);
    });

    it('measures the page and keeps every window off its content', () => {
        const box = (x: number, y: number, w: number, h: number) => () => ({ x, y, left: x, top: y, width: w, height: h, right: x + w, bottom: y + h, toJSON() {} }) as DOMRect;
        // a 1440x900 screen whose heading runs across the upper left; every window is 300x200
        const heading = { x: 100, y: 90, w: 700, h: 300 };
        vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(300);
        vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(200);
        const { container } = render(
            <main>
                <h1>Rooms</h1>
                <IdeBackdrop />
            </main>,
        );
        container.querySelector('h1')!.getBoundingClientRect = box(heading.x, heading.y, heading.w, heading.h);
        container.querySelector<HTMLElement>('.ide')!.getBoundingClientRect = box(0, 0, 1440, 900);
        wait(SETTLE_MS);
        for (const win of container.querySelectorAll<HTMLElement>('.ide-win')) {
            const x = parseFloat(win.style.getPropertyValue('--x'));
            const y = parseFloat(win.style.getPropertyValue('--y'));
            expect(win.style.getPropertyValue('--x')).toMatch(/px$/);
            expect(overlap({ x, y, w: 300, h: 200 }, heading)).toBe(0);
        }
    });

    it('brings the window being worked in to the front', () => {
        const { container } = render(<IdeBackdrop />);
        const focused = () => [...container.querySelectorAll('.ide-win.is-focused')].map((w) => w.className.match(/ide-win--(\w+)/)![1]);
        wait(AUTO_MS);
        expect(focused()).toEqual(['editor']);
        wait(AUTO_MS * 2);
        expect(focused()).toEqual(['terminal']);
    });

    it('shows the editor scrolled to the lines around the caret', () => {
        const { container } = render(<IdeBackdrop />);
        // walk the session to the first time the caret sits deep in a file
        let s = initialState();
        let n = 0;
        while (s.caret.line < 7) {
            s = step(s);
            n++;
        }
        wait(AUTO_MS * n);
        const gutters = [...container.querySelectorAll('.ide-win--editor .ide__gutter')].map((g) => Number(g.textContent));
        expect(gutters).toHaveLength(EDITOR_LINES);
        expect(gutters).toContain(s.caret.line + 1);
        expect(gutters[0]).toBeGreaterThan(1);
    });

    it('lists what the scanner flagged, and what got fixed', () => {
        const { container } = render(<IdeBackdrop />);
        const problems = () => container.querySelector('.ide-win--problems')!.textContent;
        expect(problems()).toContain('no silent failures');
        let s = initialState();
        let n = 0;
        while (!Object.values(s.marks).includes('ok')) {
            s = step(s);
            n++;
        }
        wait(AUTO_MS * n);
        expect(problems()).toContain('vite.config.ts:8 fixed');
    });

    it('rests while the tab is hidden', () => {
        vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
        const { container } = render(<IdeBackdrop />);
        wait(AUTO_MS * 10);
        expect(terminal(container)).toBe('');
    });

    it('under reduced motion is one still picture part-way through the session', () => {
        vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduce'), addEventListener() {}, removeEventListener() {} }));
        const { container } = render(<IdeBackdrop />);
        const still = stepN(initialState(), STILL_STEPS);
        expect(container.querySelector('.ide__tab.is-open')!.textContent).toBe(still.open);
        expect(terminal(container)).toBe(still.terminal.at(-1)!.text);
        const shown = container.textContent;
        wait(IDLE_MS * 2);
        fireEvent.keyDown(window, { key: 'a' });
        fireEvent.pointerMove(window, { clientX: 400, clientY: 400 });
        expect(container.textContent).toBe(shown);
    });
});
