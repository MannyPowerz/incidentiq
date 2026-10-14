import type { JSX } from 'react';
import './Badge.css';

export type BadgeTone = 'severity' | 'status' | 'entry' | 'neutral';

type BadgeProps = {
    tone: BadgeTone;
    // the raw value from the API: 'P1', 'investigating', 'ai_draft' — it picks the color AND is the label
    value: string;
    // only when the default label reads wrong; the color still comes from value
    label?: string;
};

// text, never a color-only dot: the label carries the meaning (design-system.md §4.4)
function defaultLabel(tone: BadgeTone, value: string): string {
    if (tone === 'severity') return value.toUpperCase();
    if (value === 'ai_draft') return 'AI draft';
    return value.charAt(0).toUpperCase() + value.slice(1).replace(/_/g, ' ');
}

export default function Badge({ tone, value, label }: BadgeProps): JSX.Element {
    const modifier = tone === 'neutral' ? 'ui-badge--neutral' : `ui-badge--${tone}-${value.toLowerCase()}`;
    return <span className={`ui-badge ${modifier}`}>{label ?? defaultLabel(tone, value)}</span>;
}
