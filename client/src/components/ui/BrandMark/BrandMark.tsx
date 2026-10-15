import { useState } from 'react';
import type { CSSProperties, JSX, PointerEvent } from 'react';
import './BrandMark.css';

type BrandMarkProps = {
    size?: 'sm' | 'md' | 'lg' | 'xl';
    // follows the pointer in 3D, sways when idle, flips on click
    interactive?: boolean;
};

// how far the lens turns toward the pointer, in degrees, and where it rests
const MAX_TURN = 30;
const REST_RX = 14;
const REST_RY = -22;

/**
 * BrandMark — the IncidentIOQ logo: a scanner lens. A glass ring with real thickness (stacked
 * layers in CSS 3D, no WebGL) around the orange core, a scan line sweeping it, and a red blip it
 * has caught. Hovering the brand resolves the blip to green: detect, then resolve, the product's
 * loop in one mark. Cheap enough for the top bar.
 *
 * The interactive size tilts toward the pointer, points its sweep at it, and flips once per click.
 * Decorative: the wordmark beside it is the accessible name.
 */
export default function BrandMark({ size = 'sm', interactive = false }: BrandMarkProps): JSX.Element {
    const [turn, setTurn] = useState<{ x: number; y: number } | null>(null);
    const [spins, setSpins] = useState(0);

    const onMove = (e: PointerEvent<HTMLSpanElement>) => {
        const r = e.currentTarget.getBoundingClientRect();
        setTurn({ x: ((e.clientX - r.left) / r.width - 0.5) * 2, y: ((e.clientY - r.top) / r.height - 0.5) * 2 });
    };

    // each click adds a full flip; the CSS transition plays it out
    const onClick = () => setSpins((n) => n + 1);

    // pointer tilt and click flips combine; the sweep points at the pointer (0deg is straight up)
    const style =
        interactive && (turn || spins)
            ? ({
                  '--mark-rx': `${REST_RX - (turn?.y ?? 0) * MAX_TURN}deg`,
                  '--mark-ry': `${REST_RY + (turn?.x ?? 0) * MAX_TURN + spins * 360}deg`,
                  ...(turn && { '--sweep': `${Math.round((Math.atan2(turn.y, turn.x) * 180) / Math.PI + 90)}deg` }),
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
            <span className="brand-mark__lens">
                {/* the rim's thickness: the same ring, stepped back in depth */}
                <span className="brand-mark__edge" style={{ '--z': 2 } as CSSProperties} />
                <span className="brand-mark__edge" style={{ '--z': 1 } as CSSProperties} />
                <span className="brand-mark__ring">
                    <span className="brand-mark__sweep" />
                </span>
                <span className="brand-mark__core">{(size === 'lg' || size === 'xl') && <span className="brand-mark__monogram">IOQ</span>}</span>
                <span className="brand-mark__blip" />
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
