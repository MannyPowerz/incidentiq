import { useId } from 'react';
import type { InputHTMLAttributes, JSX } from 'react';
import '../field.css';

export type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> & {
    // required on purpose: a placeholder is not a label (design-system.md §4.5)
    label: string;
    error?: string;
    hint?: string;
    mono?: boolean;
};

export default function Input({ label, error, hint, mono = false, className, ...rest }: InputProps): JSX.Element {
    const id = useId();
    const hintId = hint ? `${id}-hint` : undefined;
    const errorId = error ? `${id}-error` : undefined;
    const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

    return (
        <div className={['ui-field', className].filter(Boolean).join(' ')}>
            <label className="ui-field__label" htmlFor={id}>
                {label}
            </label>
            <input
                id={id}
                className={`ui-field__control${mono ? ' ui-field__control--mono' : ''}`}
                aria-invalid={error ? true : undefined}
                aria-describedby={describedBy}
                {...rest}
            />
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
