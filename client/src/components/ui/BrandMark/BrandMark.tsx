import { useState } from 'react';
import type { CSSProperties, JSX, PointerEvent } from 'react';
import './BrandMark.css';

type BrandMarkProps = {
    size?: 'sm' | 'md' | 'lg';
    // lg only: follows the pointer in 3D, turns slowly when idle, spins on click
    interactive?: boolean;
};

// how far the cube turns toward the pointer, in degrees
const MAX_TURN = 34;

/**
 * BrandMark — the IncidentIOQ logo: a rounded cube drawn with CSS 3D transforms, so it is real
 * depth with no WebGL and no dependency, cheap enough to sit in the top bar. Small sizes turn a
 * quarter when the brand is hovered (BrandMark.css). The interactive size follows the pointer,
 * turns slowly on its own, and spins once when clicked. Decorative: the wordmark beside it is the
 * accessible name.
 */
export default function BrandMark({ size = 'sm', interactive = false }: BrandMarkProps): JSX.Element {
    const [turn, setTurn] = useState<{ x: number; y: number } | null>(null);
    const [spins, setSpins] = useState(0);

    const onMove = (e: PointerEvent<HTMLSpanElement>) => {
        const r = e.currentTarget.getBoundingClientRect();
        setTurn({ x: ((e.clientX - r.left) / r.width - 0.5) * 2, y: ((e.clientY - r.top) / r.height - 0.5) * 2 });
    };

    // each click adds a full turn; the CSS transition plays it out
    const onClick = () => setSpins((n) => n + 1);

    // pointer turn and click spins combine: each click adds a full turn on top of where it points
    const style =
        interactive && (turn || spins)
            ? ({
                  '--mark-rx': `${-24 - (turn?.y ?? 0) * MAX_TURN}deg`,
                  '--mark-ry': `${36 + (turn?.x ?? 0) * MAX_TURN + spins * 360}deg`,
              } as CSSProperties)
            : undefined;

    const classes = ['brand-mark', `brand-mark--${size}`, interactive && 'brand-mark--interactive', interactive && turn && 'brand-mark--held']
        .filter(Boolean)
        .join(' ');

    return (
        <span
            className={classes}
            aria-hidden="true"
            style={style}
            onPointerMove={interactive ? onMove : undefined}
            onPointerLeave={interactive ? () => setTurn(null) : undefined}
            onClick={interactive ? onClick : undefined}
        >
            <span className="brand-mark__cube">
                <span className="brand-mark__face brand-mark__face--front">{size === 'lg' && <span className="brand-mark__monogram">IOQ</span>}</span>
                <span className="brand-mark__face brand-mark__face--back" />
                <span className="brand-mark__face brand-mark__face--right" />
                <span className="brand-mark__face brand-mark__face--left" />
                <span className="brand-mark__face brand-mark__face--top" />
                <span className="brand-mark__face brand-mark__face--bottom" />
            </span>
        </span>
    );
}

// the name, with IOQ in the brand's text orange; reads as one word "IncidentIOQ" to assistive tech
export function Wordmark({ className }: { className?: string }): JSX.Element {
    return (
        <span className={['wordmark', className].filter(Boolean).join(' ')}>
            Incident<span className="wordmark__accent">IOQ</span>
        </span>
    );
}
