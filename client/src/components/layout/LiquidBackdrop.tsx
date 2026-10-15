import type { JSX } from 'react';
import BubbleField from './BubbleField';
import CodeTrace from './CodeTrace';
import './LiquidBackdrop.css';

type LiquidBackdropProps = {
    // full: landing page and sign-in panel. subtle: behind every signed-in page, dimmed by --ambient-opacity
    intensity?: 'full' | 'subtle';
    // fill the parent (sign-in panel) instead of the viewport
    contained?: boolean;
};

// fewer, slower droplets behind the app: each one blurs what is under it every frame, which costs GPU time
const DROPLETS = { full: 4, subtle: 2 } as const;

/**
 * LiquidBackdrop — the "fluid gradient with liquid glass" from the redesign prompts. A slowly
 * flowing mesh in the theme's colors, with translucent droplets that drift and change shape. Each
 * droplet blurs and saturates the mesh behind it, so the color visibly bends through the glass, and
 * carries an iridescent rim and a glossy highlight. Faint code panes play out the failures the app
 * catches (CodeTrace). A fine grain keeps the gradients from banding.
 *
 * Pure CSS, so it costs no JavaScript and no dependency. Decorative and aria-hidden. It stops moving
 * under reduced motion and drops the glass under reduced transparency. Its colors are tokens, and
 * tokens.test.ts holds the text that sits on it at AA in both themes.
 */
export default function LiquidBackdrop({ intensity = 'subtle', contained = false }: LiquidBackdropProps): JSX.Element {
    return (
        <div className={`liquid liquid--${intensity}${contained ? ' liquid--contained' : ''}`} aria-hidden="true">
            <div className="liquid__mesh" />
            {/* the code panes sit behind the droplets too, so the glass bends them like everything else */}
            <CodeTrace panes={intensity === 'full' ? 3 : 2} />
            {/* the endless bubbles sit between the mesh and the glass droplets, so the droplets refract them too */}
            <BubbleField density={intensity === 'full' ? 1 : 0.6} />
            {Array.from({ length: DROPLETS[intensity] }, (_, i) => (
                <span key={i} className={`liquid__drop liquid__drop--${i + 1}`} />
            ))}
            <div className="liquid__grain" />
        </div>
    );
}
