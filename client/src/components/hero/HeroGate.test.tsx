/**
 * HeroGate.test.tsx — when the 3D hero is allowed, and that every other case gets the CSS shape.
 * jsdom has no WebGL and no matchMedia, so both are stubbed per case and Hero3D is mocked: the real
 * one is checked in a browser. What these hold is the decision, which is where the risk is.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import HeroGate from './HeroGate';

// read at render time, so one test can make the 3D hero fail the way a lost WebGL context does
const hero = vi.hoisted(() => ({ throws: false }));
vi.mock('./Hero3D', () => ({
    default: () => {
        if (hero.throws) throw new Error('WebGL context lost');
        return <div data-testid="hero-3d" />;
    },
}));

function stubMedia({ desktop = true, reducedMotion = false } = {}) {
    vi.stubGlobal('matchMedia', (query: string) => ({
        matches: query.includes('min-width') ? desktop : query.includes('reduced-motion') ? reducedMotion : false,
        addEventListener: () => {},
        removeEventListener: () => {},
    }));
}

const fallback = <span data-testid="css-shape" />;

beforeEach(() => {
    vi.unstubAllGlobals();
    hero.throws = false;
});

describe('HeroGate', () => {
    it('renders the 3D hero on a desktop with motion allowed and WebGL working', async () => {
        stubMedia();
        render(<HeroGate fallback={fallback} webgl={() => true} />);

        expect(await screen.findByTestId('hero-3d')).toBeTruthy();
    });

    // the 3D chunk must not even be requested on a phone, where the hero is hidden anyway
    it('shows the CSS shape below desktop width', () => {
        stubMedia({ desktop: false });
        render(<HeroGate fallback={fallback} webgl={() => true} />);

        expect(screen.getByTestId('css-shape')).toBeTruthy();
        expect(screen.queryByTestId('hero-3d')).toBeNull();
    });

    it('shows the CSS shape when the user prefers reduced motion', () => {
        stubMedia({ reducedMotion: true });
        render(<HeroGate fallback={fallback} webgl={() => true} />);

        expect(screen.getByTestId('css-shape')).toBeTruthy();
        expect(screen.queryByTestId('hero-3d')).toBeNull();
    });

    it('shows the CSS shape when WebGL is unavailable', () => {
        stubMedia();
        render(<HeroGate fallback={fallback} webgl={() => false} />);

        expect(screen.getByTestId('css-shape')).toBeTruthy();
    });

    it('falls back to the CSS shape instead of breaking sign-in when the 3D hero throws', async () => {
        stubMedia();
        hero.throws = true;
        // React logs the caught error; silence it so the run output stays readable
        const quiet = vi.spyOn(console, 'error').mockImplementation(() => {});

        render(<HeroGate fallback={fallback} webgl={() => true} />);

        expect(await screen.findByTestId('css-shape')).toBeTruthy();
        expect(screen.queryByTestId('hero-3d')).toBeNull();
        quiet.mockRestore();
    });
});
