import type { JSX, ReactNode } from 'react';
import '../states.css';

type EmptyStateProps = {
    title: string;
    body?: string;
    // usually the button that fixes the emptiness ("Create a room")
    action?: ReactNode;
};

export default function EmptyState({ title, body, action }: EmptyStateProps): JSX.Element {
    return (
        <div className="ui-state">
            <p className="ui-state__title">{title}</p>
            {body && <p className="ui-state__body">{body}</p>}
            {action && <div className="ui-state__action">{action}</div>}
        </div>
    );
}
