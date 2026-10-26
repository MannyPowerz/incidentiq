import type { CSSProperties, JSX, ReactNode } from 'react';
import { BrandMark } from '../ui';
import './IoScene.css';

type Tile = { label: string; icon: ReactNode };

// incident signals going in: the silent failures the product exists to catch
const INPUTS: Tile[] = [
    { label: 'ECONNRESET :4000', icon: <path d="M12 3 2 20h20L12 3Zm0 6v5m0 3h.01" /> },
    { label: 'port 5173 silent', icon: <path d="M7 3v5M17 3v5M5 8h14v4a7 7 0 0 1-14 0V8Zm7 11v2" /> },
    { label: 'lockfile ≠ main', icon: <path d="M6 11V8a6 6 0 0 1 12 0v3M5 11h14v10H5V11Zm7 4v2" /> },
];

// what comes out: decisions a human made, with the room's help
const OUTPUTS: Tile[] = [
    { label: 'draft confirmed', icon: <path d="m4 12 5 5L20 6" /> },
    { label: 'room #42 resolved', icon: <path d="M4 12a8 8 0 1 0 16 0 8 8 0 0 0-16 0Zm4 0 3 3 5-6" /> },
    { label: 'migrations in sync', icon: <path d="M4 7h12l-3-3M20 17H8l3 3" /> },
];

const LOG = ['14:05:09  socket  timeline up to date', '14:05:12  ai      draft #6 ready, 6.9s', '14:05:20  room    draft #6 confirmed'];

function TileView({ tile, kind, index }: { tile: Tile; kind: 'in' | 'out'; index: number }): JSX.Element {
    return (
        <span className={`io-tile io-tile--${kind}`} style={{ '--i': index } as CSSProperties}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
                {tile.icon}
            </svg>
            {tile.label}
        </span>
    );
}

/**
 * IoScene — the product in one picture: incident signals stream in, the IncidentIOQ scanner lens (the
 * "IQ" in the middle of I/O) works on them, resolved outcomes stream out, and the activity log
 * types above it. An isometric stage built with CSS 3D, so it costs no WebGL. The whole stage leans
 * with the cursor through the page-wide pointer field; the lens itself follows the cursor, aims its sweep and flips
 * when clicked. Still under reduced motion. Described in one sentence for assistive tech.
 */
export default function IoScene(): JSX.Element {
    return (
        <figure className="io-scene">
            <figcaption className="ui-sr-only">
                Incident signals flow into IncidentIOQ, and confirmed fixes and resolved rooms flow out.
            </figcaption>
            <div className="io-scene__stage" aria-hidden="true">
                <div className="io-scene__floor" />
                <div className="io-scene__glow" />
                <div className="io-lane io-lane--in">
                    {INPUTS.map((t, i) => (
                        <TileView key={t.label} tile={t} kind="in" index={i} />
                    ))}
                </div>
                <div className="io-lane io-lane--out">
                    {OUTPUTS.map((t, i) => (
                        <TileView key={t.label} tile={t} kind="out" index={i} />
                    ))}
                </div>
                <div className="io-scene__core">
                    <BrandMark size="lg" interactive />
                </div>
            </div>
            {/* flat, outside the tipped stage, so it never covers the lens */}
            <div className="io-terminal ui-glass" aria-hidden="true">
                <span className="io-terminal__dots">
                    <i />
                    <i />
                    <i />
                </span>
                {LOG.map((line, i) => (
                    <code key={line} className="io-terminal__line" style={{ '--i': i } as CSSProperties}>
                        {line}
                    </code>
                ))}
            </div>
        </figure>
    );
}
