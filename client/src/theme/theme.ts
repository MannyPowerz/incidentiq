/**
 * theme.ts — which palette is on, and why.
 *
 * The choice is "system" (follow the OS, live), "light" or "dark", remembered per browser. It
 * resolves to a theme that is written to <html data-theme>, which is the one selector tokens.css
 * keys the light palette on. index.html runs the same resolution before first paint, so the page
 * never flashes the wrong theme; THEME_KEY must match the key that script reads.
 *
 * localStorage is fine here: a theme preference is not a secret (the access token never goes there).
 */

import { useCallback, useEffect, useState } from 'react';

export type ThemeChoice = 'system' | 'light' | 'dark';
export type Theme = 'light' | 'dark';

export const THEME_KEY = 'iiq-theme';
const LIGHT_QUERY = '(prefers-color-scheme: light)';

// jsdom and very old browsers have no matchMedia; treat that as "the OS prefers dark"
const systemPrefersLight = () => typeof window.matchMedia === 'function' && window.matchMedia(LIGHT_QUERY).matches;

export function readChoice(): ThemeChoice {
    try {
        const stored = localStorage.getItem(THEME_KEY);
        return stored === 'light' || stored === 'dark' ? stored : 'system';
    } catch {
        // storage blocked (private mode, locked-down browser): follow the system
        return 'system';
    }
}

export function resolveTheme(choice: ThemeChoice): Theme {
    if (choice !== 'system') return choice;
    return systemPrefersLight() ? 'light' : 'dark';
}

export function applyTheme(theme: Theme): void {
    document.documentElement.dataset.theme = theme;
}

function saveChoice(choice: ThemeChoice): void {
    try {
        if (choice === 'system') localStorage.removeItem(THEME_KEY);
        else localStorage.setItem(THEME_KEY, choice);
    } catch {
        // not remembered, but still applied for this visit
    }
}

const NEXT: Record<ThemeChoice, ThemeChoice> = { system: 'light', light: 'dark', dark: 'system' };

export function useTheme(): { choice: ThemeChoice; theme: Theme; cycle: () => void } {
    const [choice, setChoice] = useState<ThemeChoice>(readChoice);
    const [theme, setTheme] = useState<Theme>(() => resolveTheme(readChoice()));

    useEffect(() => {
        const sync = () => {
            const next = resolveTheme(choice);
            applyTheme(next);
            setTheme(next);
        };
        sync();
        // only "system" follows the OS; an explicit choice ignores it
        if (choice !== 'system' || typeof window.matchMedia !== 'function') return;
        const list = window.matchMedia(LIGHT_QUERY);
        list.addEventListener('change', sync);
        return () => list.removeEventListener('change', sync);
    }, [choice]);

    const cycle = useCallback(() => {
        setChoice((current) => {
            const next = NEXT[current];
            saveChoice(next);
            return next;
        });
    }, []);

    return { choice, theme, cycle };
}
