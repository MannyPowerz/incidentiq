/**
 * BrandMark.test.tsx — the scanner lens is decorative (the wordmark is the name), the interactive one
 * tilts toward the pointer, points its sweep at it and flips once per click, and the small ones take
 * no pointer input.
 */

import { describe, it, expect } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import BrandMark, { Wordmark } from './BrandMark';

// jsdom gives every element a zero-size box, so the mark gets a real one for the pointer math
function sized(el: Element) {
    (el as HTMLElement).getBoundingClientRect = () => ({ left: 0, top: 0, width: 100, height: 100, right: 100, bottom: 100, x: 0, y: 0, toJSON() {} });
    return el as HTMLElement;
}
const turn = (el: HTMLElement) => [el.style.getPropertyValue('--mark-rx'), el.style.getPropertyValue('--mark-ry')];
const sweep = (el: HTMLElement) => el.style.getPropertyValue('--sweep');

describe('BrandMark', () => {
    it('is a scanner lens, a thick ring with a sweep, a core and a caught blip, hidden from assistive tech', () => {
        const { container } = render(<BrandMark />);
        expect(container.firstElementChild!.getAttribute('aria-hidden')).toBe('true');
        expect(container.querySelectorAll('.brand-mark__edge')).toHaveLength(2);
        for (const part of ['ring', 'sweep', 'core', 'blip']) expect(container.querySelector(`.brand-mark__${part}`)).not.toBeNull();
    });

    it('shows the IOQ monogram only at the large size', () => {
        const { container, rerender } = render(<BrandMark size="lg" />);
        expect(container.querySelector('.brand-mark__monogram')!.textContent).toBe('IOQ');
        rerender(<BrandMark size="sm" />);
        expect(container.querySelector('.brand-mark__monogram')).toBeNull();
    });

    it('tilts toward the pointer and points its sweep at it, and goes back to rest when it leaves', () => {
        const { container } = render(<BrandMark size="lg" interactive />);
        const mark = sized(container.firstElementChild!);

        // the right edge, halfway down: tilt fully right, sweep pointing right (0deg is up)
        fireEvent.pointerMove(mark, { clientX: 100, clientY: 50 });
        expect(turn(mark)).toEqual(['14deg', '8deg']);
        expect(sweep(mark)).toBe('90deg');
        expect(mark.classList.contains('brand-mark--held')).toBe(true);

        // the bottom edge, halfway across: tilt fully down, sweep pointing down
        fireEvent.pointerMove(mark, { clientX: 50, clientY: 100 });
        expect(turn(mark)).toEqual(['-16deg', '-22deg']);
        expect(sweep(mark)).toBe('180deg');

        fireEvent.pointerLeave(mark);
        expect(turn(mark)).toEqual(['', '']);
        expect(sweep(mark)).toBe('');
        expect(mark.classList.contains('brand-mark--held')).toBe(false);
    });

    it('adds a full flip for every click', () => {
        const { container } = render(<BrandMark size="lg" interactive />);
        const mark = sized(container.firstElementChild!);

        fireEvent.click(mark);
        fireEvent.click(mark);

        expect(turn(mark)[1]).toBe(`${-22 + 720}deg`);
    });

    it('ignores the pointer when it is not interactive', () => {
        const { container } = render(<BrandMark size="sm" />);
        const mark = sized(container.firstElementChild!);
        fireEvent.pointerMove(mark, { clientX: 100, clientY: 50 });
        fireEvent.click(mark);
        expect(turn(mark)).toEqual(['', '']);
    });
});

describe('Wordmark', () => {
    it('reads as one word, with IOQ as the accent', () => {
        render(<Wordmark />);
        const word = screen.getByText((_, el) => el?.className === 'wordmark' && el.textContent === 'IncidentIOQ');
        expect(word.querySelector('.wordmark__accent')!.textContent).toBe('IOQ');
    });
});
