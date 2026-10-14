import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { JSX, ReactNode } from 'react';
import './Toast.css';

export type ToastTone = 'success' | 'error' | 'info';

type ToastItem = { id: number; tone: ToastTone; message: string };

type ToastApi = {
    show: (tone: ToastTone, message: string, durationMs?: number) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

// three at once is the cap; a fourth pushes out the oldest rather than stacking off-screen
const MAX_VISIBLE = 3;
const DEFAULT_DURATION_MS = 5000;

/**
 * ToastProvider — one live region for the whole app, mounted once near the root.
 * Two regions, not one: errors go in an assertive region so they interrupt, everything else
 * waits politely. A single region with per-item role="alert" would announce inconsistently.
 */
export function ToastProvider({ children }: { children: ReactNode }): JSX.Element {
    const [items, setItems] = useState<ToastItem[]>([]);
    const nextId = useRef(1);
    const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

    const dismiss = useCallback((id: number) => {
        setItems((current) => current.filter((item) => item.id !== id));
        const timer = timers.current.get(id);
        if (timer) clearTimeout(timer);
        timers.current.delete(id);
    }, []);

    const show = useCallback(
        (tone: ToastTone, message: string, durationMs = DEFAULT_DURATION_MS) => {
            const id = nextId.current++;
            setItems((current) => [...current, { id, tone, message }].slice(-MAX_VISIBLE));
            timers.current.set(
                id,
                setTimeout(() => dismiss(id), durationMs),
            );
        },
        [dismiss],
    );

    // clear pending timers on unmount so a dismiss never fires against a gone component
    useEffect(() => {
        const pending = timers.current;
        return () => pending.forEach((timer) => clearTimeout(timer));
    }, []);

    const errors = items.filter((item) => item.tone === 'error');
    const others = items.filter((item) => item.tone !== 'error');

    return (
        <ToastContext.Provider value={{ show }}>
            {children}
            <div className="ui-toast-stack">
                <div aria-live="assertive" aria-atomic="false">
                    {errors.map((item) => (
                        <ToastView key={item.id} item={item} onDismiss={dismiss} />
                    ))}
                </div>
                <div aria-live="polite" aria-atomic="false">
                    {others.map((item) => (
                        <ToastView key={item.id} item={item} onDismiss={dismiss} />
                    ))}
                </div>
            </div>
        </ToastContext.Provider>
    );
}

function ToastView({ item, onDismiss }: { item: ToastItem; onDismiss: (id: number) => void }): JSX.Element {
    return (
        <div className={`ui-toast ui-toast--${item.tone}`}>
            <span className="ui-toast__message">{item.message}</span>
            <button type="button" className="ui-toast__dismiss" onClick={() => onDismiss(item.id)} aria-label="Dismiss notification">
                ×
            </button>
        </div>
    );
}

// throws outside the provider instead of returning a no-op, so a missing provider fails loudly in dev
export function useToast(): ToastApi {
    const api = useContext(ToastContext);
    if (!api) throw new Error('useToast must be used inside <ToastProvider>');
    return api;
}
