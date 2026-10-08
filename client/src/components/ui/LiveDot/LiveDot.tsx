import type { JSX } from 'react';
import './LiveDot.css';

export type LiveState = 'idle' | 'live' | 'syncing' | 'failing';

type LiveDotProps = {
    state: LiveState;
    // spoken and, unless hidden, shown next to the dot — the dot alone is never the only signal
    label: string;
    hideLabel?: boolean;
};

const FALLBACK_LABEL: Record<LiveState, string> = {
    idle: 'Idle',
    live: 'Live',
    syncing: 'Syncing',
    failing: 'Failing',
};

/**
 * LiveDot — the real-time status mark: scanner running, room connected, agent sync. Pulses while
 * live or syncing; goes static under reduced motion with the color still carrying the state.
 */
export default function LiveDot({ state, label, hideLabel = false }: LiveDotProps): JSX.Element {
    const text = label || FALLBACK_LABEL[state];
    return (
        <span className={`ui-livedot ui-livedot--${state}`} role="status">
            <span className="ui-livedot__dot" aria-hidden="true" />
            <span className={hideLabel ? 'ui-sr-only' : 'ui-livedot__label'}>{text}</span>
        </span>
    );
}
