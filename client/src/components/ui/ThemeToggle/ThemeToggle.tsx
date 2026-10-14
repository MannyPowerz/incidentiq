import type { JSX } from 'react';
import { useTheme } from '../../../theme/theme';
import type { ThemeChoice } from '../../../theme/theme';
import './ThemeToggle.css';

const LABEL: Record<ThemeChoice, string> = { system: 'Auto', light: 'Light', dark: 'Dark' };
const NEXT_LABEL: Record<ThemeChoice, string> = { system: 'light', light: 'dark', dark: 'automatic' };

// one icon per choice, drawn inline so there is no icon dependency
function Icon({ choice }: { choice: ThemeChoice }): JSX.Element {
    if (choice === 'light') {
        return (
            <svg viewBox="0 0 16 16" aria-hidden="true">
                <circle cx="8" cy="8" r="3" />
                <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.4 1.4M11.6 11.6 13 13M3 13l1.4-1.4M11.6 4.4 13 3" />
            </svg>
        );
    }
    if (choice === 'dark') {
        return (
            <svg viewBox="0 0 16 16" aria-hidden="true">
                <path d="M13 9.5A5.5 5.5 0 0 1 6.5 3a5.5 5.5 0 1 0 6.5 6.5Z" />
            </svg>
        );
    }
    return (
        <svg viewBox="0 0 16 16" aria-hidden="true">
            <circle cx="8" cy="8" r="5.5" />
            <path d="M8 2.5v11a5.5 5.5 0 0 0 0-11Z" className="ui-theme-toggle__fill" />
        </svg>
    );
}

/**
 * ThemeToggle — cycles Auto → Light → Dark. "Auto" follows the operating system live; the other two
 * are remembered in this browser. The label is visible, so the current mode is never a guess.
 */
export default function ThemeToggle(): JSX.Element {
    const { choice, cycle } = useTheme();
    return (
        <button
            type="button"
            className="ui-theme-toggle"
            onClick={cycle}
            aria-label={`Theme: ${LABEL[choice]}. Switch to ${NEXT_LABEL[choice]}`}
            title={`Switch to ${NEXT_LABEL[choice]}`}
        >
            <Icon choice={choice} />
            <span aria-hidden="true">{LABEL[choice]}</span>
        </button>
    );
}
