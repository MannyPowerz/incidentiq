import type { ButtonHTMLAttributes, JSX } from 'react';
import Spinner from '../Spinner/Spinner';
import './Button.css';

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
    size?: 'sm' | 'md';
    loading?: boolean;
};

export default function Button({
    variant = 'primary',
    size = 'md',
    loading = false,
    disabled,
    // 'button', not the browser default 'submit': a button inside a form should only submit when it says so
    type = 'button',
    className,
    children,
    ...rest
}: ButtonProps): JSX.Element {
    const classes = ['ui-btn', `ui-btn--${variant}`, `ui-btn--${size}`, loading && 'ui-btn--loading', className]
        .filter(Boolean)
        .join(' ');

    return (
        <button type={type} className={classes} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
            {loading && <Spinner size="sm" label="Loading" />}
            {/* the label stays in the layout while loading so the button does not change width */}
            <span className="ui-btn__label">{children}</span>
        </button>
    );
}
