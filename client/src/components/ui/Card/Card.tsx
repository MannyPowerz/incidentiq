import type { JSX, ReactNode } from 'react';
import './Card.css';

type CardProps = {
    title?: string;
    // buttons or links aligned opposite the title
    actions?: ReactNode;
    padding?: 'sm' | 'md';
    children: ReactNode;
    className?: string;
};

export default function Card({ title, actions, padding = 'md', children, className }: CardProps): JSX.Element {
    return (
        <section className={['ui-card', `ui-card--pad-${padding}`, className].filter(Boolean).join(' ')}>
            {(title || actions) && (
                <header className="ui-card__header">
                    {title && <h2 className="ui-card__title">{title}</h2>}
                    {actions && <div className="ui-card__actions">{actions}</div>}
                </header>
            )}
            {children}
        </section>
    );
}
