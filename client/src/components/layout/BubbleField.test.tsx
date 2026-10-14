/**
 * BubbleField.test.tsx — decorative and safe where there is no canvas: jsdom has no 2D context,
 * and the component must render and unmount cleanly without one (an old browser, a locked-down one).
 */

import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import BubbleField from './BubbleField';

describe('BubbleField', () => {
    it('renders a hidden canvas and survives having no 2D context', () => {
        const { container, unmount } = render(<BubbleField />);
        const canvas = container.querySelector('canvas')!;
        expect(canvas.getAttribute('aria-hidden')).toBe('true');
        expect(() => unmount()).not.toThrow();
    });
});
