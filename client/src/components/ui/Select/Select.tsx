import { useId } from 'react';
import type { JSX, SelectHTMLAttributes } from 'react';
import '../field.css';

export type SelectOption = { value: string; label: string };

export type SelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id' | 'children'> & {
    label: string;
    options: SelectOption[];
    error?: string;
    hint?: string;
    // rendered as a disabled first option, so an unchosen value is visible rather than silently defaulting
    placeholder?: string;
};

// native <select> on purpose: keyboard, screen-reader, and mobile behavior come free
export default function Select({ label, options, error, hint, placeholder, className, ...rest }: SelectProps): JSX.Element {
    const id = useId();
    const hintId = hint ? `${id}-hint` : undefined;
    const errorId = error ? `${id}-error` : undefined;
    const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

    return (
        <div className={['ui-field', className].filter(Boolean).join(' ')}>
            <label className="ui-field__label" htmlFor={id}>
                {label}
            </label>
            <select
                id={id}
                className="ui-field__control"
                aria-invalid={error ? true : undefined}
                aria-describedby={describedBy}
                {...rest}
            >
                {placeholder && (
                    <option value="" disabled>
                        {placeholder}
                    </option>
                )}
                {options.map((option) => (
                    <option key={option.value} value={option.value}>
                        {option.label}
                    </option>
                ))}
            </select>
            {hint && (
                <p id={hintId} className="ui-field__hint">
                    {hint}
                </p>
            )}
            {error && (
                <p id={errorId} className="ui-field__error" role="alert">
                    {error}
                </p>
            )}
        </div>
    );
}
