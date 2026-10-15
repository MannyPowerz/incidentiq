/**
 * IdeBackdrop.test.tsx — it works by itself from the first frame; your cursor, scrolling, keys and
 * clicks drive it instead and pause the autopilot until you have been idle for IDLE_MS; the edited
 * line follows the cursor; it never shows what you typed; and reduced motion is one still picture.
 */

import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { act, fireEvent, render } from '@testing-library/react';
import IdeBackdrop, { AUTO_MS, CLICK_STEPS, IDLE_MS, KEY_STEPS, MOVE_PX, SCROLL_PX, STILL_STEPS } from './IdeBackdrop';
import { initialState, stepN } from './ideScript';

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
        expect(container.querySelectorAll('.ide__line').length).toBeGreaterThan(10);
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

    it('brings the caret to the cursor', () => {
        const { container } = render(<IdeBackdrop />);
        fireEvent.pointerMove(window, { clientX: 512, clientY: 321 });
        const editor = container.querySelector<HTMLElement>('.ide__editor')!;
        expect([editor.style.getPropertyValue('--ide-x'), editor.style.getPropertyValue('--ide-y')]).toEqual(['512px', '321px']);
        const code = container.querySelector<HTMLElement>('.ide__code')!;
        expect([code.style.getPropertyValue('--caret-line'), code.style.getPropertyValue('--caret-col')]).toEqual(['0', '0']);
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
