import { useId } from 'react';
import type { JSX, TextareaHTMLAttributes } from 'react';
import '../field.css';

export type TextareaProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'> & {
    label: string;
    error?: string;
    hint?: string;
    // for pasted logs and scanner output, where character-level comparison matters
    mono?: boolean;
};

export default function Textarea({ label, error, hint, mono = false, rows = 4, className, ...rest }: TextareaProps): JSX.Element {
    const id = useId();
    const hintId = hint ? `${id}-hint` : undefined;
    const errorId = error ? `${id}-error` : undefined;
    const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

    return (
        <div className={['ui-field', className].filter(Boolean).join(' ')}>
            <label className="ui-field__label" htmlFor={id}>
                {label}
            </label>
            <textarea
                id={id}
                rows={rows}
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
