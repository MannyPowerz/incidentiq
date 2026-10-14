/**
 * BrandMark.test.tsx — the cube is decorative (the wordmark is the name), the interactive one turns
 * toward the pointer and adds a full turn per click, and the small ones take no pointer input.
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

describe('BrandMark', () => {
    it('is a six-faced cube hidden from assistive tech', () => {
        const { container } = render(<BrandMark />);
        expect(container.firstElementChild!.getAttribute('aria-hidden')).toBe('true');
        expect(container.querySelectorAll('.brand-mark__face')).toHaveLength(6);
    });

    it('shows the IOQ monogram only at the large size', () => {
        const { container, rerender } = render(<BrandMark size="lg" />);
        expect(container.querySelector('.brand-mark__monogram')!.textContent).toBe('IOQ');
        rerender(<BrandMark size="sm" />);
        expect(container.querySelector('.brand-mark__monogram')).toBeNull();
    });

    it('turns toward the pointer, and back to rest when it leaves', () => {
        const { container } = render(<BrandMark size="lg" interactive />);
        const mark = sized(container.firstElementChild!);

        fireEvent.pointerMove(mark, { clientX: 100, clientY: 50 });
        expect(turn(mark)).toEqual(['-24deg', '70deg']);
        expect(mark.classList.contains('brand-mark--held')).toBe(true);

        fireEvent.pointerLeave(mark);
        expect(turn(mark)).toEqual(['', '']);
        expect(mark.classList.contains('brand-mark--held')).toBe(false);
    });

    it('adds a full turn for every click', () => {
        const { container } = render(<BrandMark size="lg" interactive />);
        const mark = sized(container.firstElementChild!);

        fireEvent.click(mark);
        fireEvent.click(mark);

        expect(turn(mark)[1]).toBe(`${36 + 720}deg`);
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
