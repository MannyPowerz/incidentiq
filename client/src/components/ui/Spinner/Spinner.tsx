import type { JSX } from 'react';
import './Spinner.css';

type SpinnerProps = {
    size?: 'sm' | 'md';
    // read by screen readers only; the spinner itself is decorative
    label?: string;
};

export default function Spinner({ size = 'md', label = 'Loading' }: SpinnerProps): JSX.Element {
    return (
        <span className={`ui-spinner ui-spinner--${size}`} role="status">
            <span className="ui-spinner__ring" aria-hidden="true" />
            <span className="ui-sr-only">{label}</span>
        </span>
    );
}
