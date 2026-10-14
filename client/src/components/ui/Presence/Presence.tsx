import type { JSX } from 'react';
import './Presence.css';

export type PresenceUser = { id: number | string; label: string };

type PresenceProps = {
    users: PresenceUser[];
    // beyond this many, the rest collapse into a "+N" chip
    max?: number;
    size?: 'sm' | 'md';
};

// "Manny Hailu" -> "MH"; "manny@example.com" -> "M"
function initials(label: string): string {
    // drop an email's domain first, or "anthony@example.com" reads as "AE"
    const words = label.split('@')[0]!.split(/[\s._-]+/).filter(Boolean);
    const first = words[0]?.[0] ?? '?';
    const second = words.length > 1 ? words[1]?.[0] ?? '' : '';
    return (first + second).toUpperCase();
}

// a stable hue per user so the same person is the same color everywhere, with no avatar images yet
function hue(id: number | string): number {
    const s = String(id);
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
    return h;
}

/**
 * Presence — who is in the room. Overlapping initial chips with an accessible list behind them.
 */
export default function Presence({ users, max = 4, size = 'md' }: PresenceProps): JSX.Element {
    const shown = users.slice(0, max);
    const overflow = users.length - shown.length;
    const names = users.map((u) => u.label).join(', ');

    return (
        <div className={`ui-presence ui-presence--${size}`} role="group" aria-label={`${users.length} in room: ${names}`}>
            {shown.map((user) => (
                <span
                    key={user.id}
                    className="ui-presence__chip"
                    style={{ '--presence-hue': hue(user.id) } as React.CSSProperties}
                    title={user.label}
                    aria-hidden="true"
                >
                    {initials(user.label)}
                </span>
            ))}
            {overflow > 0 && (
                <span className="ui-presence__chip ui-presence__chip--more" aria-hidden="true">
                    +{overflow}
                </span>
            )}
        </div>
    );
}
