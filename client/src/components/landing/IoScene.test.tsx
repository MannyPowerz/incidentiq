/**
 * IoScene.test.tsx — the hero picture: three incidents in, three outcomes out, the logo lens at the
 * center, the log above, and one plain sentence for assistive tech instead of the decoration.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import IoScene from './IoScene';

describe('IoScene', () => {
    it('describes itself in one sentence and hides the decoration', () => {
        const { container } = render(<IoScene />);
        expect(screen.getByText(/Incident signals flow into IncidentIOQ/)).toBeTruthy();
        expect(container.querySelector('.io-scene__stage')!.getAttribute('aria-hidden')).toBe('true');
        // the terminal sits outside the stage, so it needs its own
        expect(container.querySelector('.io-terminal')!.getAttribute('aria-hidden')).toBe('true');
    });

    it('flows three incidents in and three outcomes out around the logo lens', () => {
        const { container } = render(<IoScene />);
        expect(container.querySelectorAll('.io-tile--in')).toHaveLength(3);
        expect(container.querySelectorAll('.io-tile--out')).toHaveLength(3);
        expect(container.querySelector('.io-scene__core .brand-mark--interactive')).not.toBeNull();
        expect(container.querySelectorAll('.io-terminal__line')).toHaveLength(3);
    });
});
