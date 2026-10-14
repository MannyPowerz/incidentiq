import type { JSX } from 'react';
import Button from '../Button/Button';
import '../states.css';

type ErrorStateProps = {
    title: string;
    // pass ApiError.message — already a string, never a raw ZodError object (see client/src/api/client.ts)
    body: string;
    retry?: () => void;
};

export default function ErrorState({ title, body, retry }: ErrorStateProps): JSX.Element {
    return (
        <div className="ui-state ui-state--error" role="alert">
            <p className="ui-state__title">{title}</p>
            <p className="ui-state__body">{body}</p>
            {retry && (
                <div className="ui-state__action">
                    <Button variant="secondary" onClick={retry}>
                        Try again
                    </Button>
                </div>
            )}
        </div>
    );
}
