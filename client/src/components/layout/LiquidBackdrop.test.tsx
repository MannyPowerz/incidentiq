/**
 * LiquidBackdrop.test.tsx — decorative only (hidden from assistive tech), and fewer droplets behind
 * the app than on the landing page, because each droplet costs GPU time every frame.
 */

import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import LiquidBackdrop from './LiquidBackdrop';

describe('LiquidBackdrop', () => {
    it('is hidden from assistive tech', () => {
        const { container } = render(<LiquidBackdrop />);
        expect(container.firstElementChild!.getAttribute('aria-hidden')).toBe('true');
    });

    it('draws four droplets at full strength and two when subtle', () => {
        const full = render(<LiquidBackdrop intensity="full" />);
        expect(full.container.querySelectorAll('.liquid__drop')).toHaveLength(4);
        full.unmount();
        const subtle = render(<LiquidBackdrop intensity="subtle" />);
        expect(subtle.container.querySelectorAll('.liquid__drop')).toHaveLength(2);
    });

    it('fills its parent instead of the viewport when contained', () => {
        const { container } = render(<LiquidBackdrop intensity="full" contained />);
        expect(container.firstElementChild!.className).toBe('liquid liquid--full liquid--contained');
    });
});
