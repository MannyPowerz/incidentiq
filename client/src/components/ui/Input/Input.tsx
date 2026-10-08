import { useId } from 'react';
import type { InputHTMLAttributes, JSX, ReactNode } from 'react';
import '../field.css';

export type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> & {
    // required on purpose: a placeholder is not a label (design-system.md §4.5)
    label: string;
    error?: string;
    hint?: string;
    mono?: boolean;
    // a control drawn inside the field's right edge, e.g. a password show/hide button
    trailing?: ReactNode;
};

export default function Input({ label, error, hint, mono = false, trailing, className, ...rest }: InputProps): JSX.Element {
    const id = useId();
    const hintId = hint ? `${id}-hint` : undefined;
    const errorId = error ? `${id}-error` : undefined;
    const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

    return (
        <div className={['ui-field', className].filter(Boolean).join(' ')}>
            <label className="ui-field__label" htmlFor={id}>
                {label}
            </label>
            <div className={trailing ? 'ui-field__wrap ui-field__wrap--trailing' : 'ui-field__wrap'}>
                <input
                    id={id}
                    className={`ui-field__control${mono ? ' ui-field__control--mono' : ''}`}
                    aria-invalid={error ? true : undefined}
                    aria-describedby={describedBy}
                    {...rest}
                />
                {trailing && <div className="ui-field__trailing">{trailing}</div>}
            </div>
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
