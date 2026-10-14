import { useEffect, useId, useRef } from 'react';
import type { JSX, KeyboardEvent, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import './Modal.css';

type ModalProps = {
    open: boolean;
    onClose: () => void;
    title: string;
    size?: 'sm' | 'md';
    children: ReactNode;
};

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Modal — a dialog that traps focus while open, closes on Escape or backdrop click, locks page
 * scroll, and returns focus to whatever opened it.
 * Hand-rolled rather than native <dialog>: showModal() support in the jsdom test environment is
 * incomplete, and the trap/restore behavior is the part worth testing.
 */
export default function Modal({ open, onClose, title, size = 'md', children }: ModalProps): JSX.Element | null {
    const titleId = useId();
    const panelRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const opener = document.activeElement as HTMLElement | null;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        // the first control in the BODY, so a create-room dialog opens ready to type; the close
        // button sits earlier in the DOM and would otherwise win. Panel itself is the last resort.
        const panel = panelRef.current;
        const first =
            panel?.querySelector<HTMLElement>(`.ui-modal__body :is(${FOCUSABLE})`) ??
            panel?.querySelector<HTMLElement>(FOCUSABLE);
        (first ?? panel)?.focus();

        return () => {
            document.body.style.overflow = previousOverflow;
            opener?.focus();
        };
    }, [open]);

    if (!open) return null;

    function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
        if (event.key === 'Escape') {
            event.stopPropagation();
            onClose();
            return;
        }
        if (event.key !== 'Tab' || !panelRef.current) return;

        // wrap Tab at both ends so focus can't leave the dialog
        const focusables = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
        if (focusables.length === 0) {
            event.preventDefault();
            return;
        }
        const firstEl = focusables[0];
        const lastEl = focusables[focusables.length - 1];
        if (event.shiftKey && document.activeElement === firstEl) {
            event.preventDefault();
            lastEl?.focus();
        } else if (!event.shiftKey && document.activeElement === lastEl) {
            event.preventDefault();
            firstEl?.focus();
        }
    }

    return createPortal(
        <div className="ui-modal" onKeyDown={handleKeyDown}>
            <div className="ui-modal__backdrop" onClick={onClose} aria-hidden="true" />
            <div
                ref={panelRef}
                className={`ui-modal__panel ui-modal__panel--${size} ui-glass`}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                tabIndex={-1}
            >
                <header className="ui-modal__header">
                    <h2 id={titleId} className="ui-modal__title">
                        {title}
                    </h2>
                    <button type="button" className="ui-modal__close" onClick={onClose} aria-label="Close dialog">
                        ×
                    </button>
                </header>
                <div className="ui-modal__body">{children}</div>
            </div>
        </div>,
        document.body,
    );
}
