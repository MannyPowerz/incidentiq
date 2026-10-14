/**
 * theme.test.tsx — which theme is on and why: a stored choice wins, otherwise the OS decides, and
 * "Auto" keeps following the OS live. The toggle cycles Auto → Light → Dark and says where it is.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { THEME_KEY, readChoice, resolveTheme } from './theme';
import ThemeToggle from '../components/ui/ThemeToggle/ThemeToggle';

// a controllable OS setting: `prefersLight` drives the query, `fire` plays an OS change
function stubSystem(prefersLight: boolean) {
    const listeners = new Set<() => void>();
    const state = { matches: prefersLight };
    vi.stubGlobal('matchMedia', () => ({
        get matches() {
            return state.matches;
        },
        addEventListener: (_: string, fn: () => void) => listeners.add(fn),
        removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
    }));
    return {
        fire(next: boolean) {
            state.matches = next;
            listeners.forEach((fn) => fn());
        },
    };
}

const theme = () => document.documentElement.dataset.theme;

beforeEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
    delete document.documentElement.dataset.theme;
});

describe('theme', () => {
    it('follows the system when nothing is stored', () => {
        stubSystem(true);
        expect(readChoice()).toBe('system');
        expect(resolveTheme('system')).toBe('light');
    });

    it('lets a stored choice win over the system', () => {
        stubSystem(true);
        localStorage.setItem(THEME_KEY, 'dark');
        expect(readChoice()).toBe('dark');
        expect(resolveTheme(readChoice())).toBe('dark');
    });

    it('ignores a stored value that is not a theme', () => {
        localStorage.setItem(THEME_KEY, 'purple');
        expect(readChoice()).toBe('system');
    });

    it('falls back to the system when storage is blocked', () => {
        stubSystem(false);
        vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
            throw new Error('SecurityError');
        });
        expect(readChoice()).toBe('system');
        expect(resolveTheme('system')).toBe('dark');
    });
});

describe('ThemeToggle', () => {
    it('cycles Auto → Light → Dark → Auto, applying and remembering each', () => {
        stubSystem(false);
        render(<ThemeToggle />);
        const button = screen.getByRole('button');
        expect(button.getAttribute('aria-label')).toBe('Theme: Auto. Switch to light');
        expect(theme()).toBe('dark');

        fireEvent.click(button);
        expect(theme()).toBe('light');
        expect(localStorage.getItem(THEME_KEY)).toBe('light');

        fireEvent.click(button);
        expect(theme()).toBe('dark');
        expect(localStorage.getItem(THEME_KEY)).toBe('dark');

        fireEvent.click(button);
        expect(button.getAttribute('aria-label')).toBe('Theme: Auto. Switch to light');
        // back to Auto: nothing stored, so the next visit follows the OS again
        expect(localStorage.getItem(THEME_KEY)).toBeNull();
    });

    it('on Auto, switches live when the OS setting changes', () => {
        const os = stubSystem(false);
        render(<ThemeToggle />);
        expect(theme()).toBe('dark');

        act(() => os.fire(true));

        expect(theme()).toBe('light');
    });

    it('on an explicit choice, ignores the OS setting changing', () => {
        const os = stubSystem(false);
        localStorage.setItem(THEME_KEY, 'dark');
        render(<ThemeToggle />);

        act(() => os.fire(true));

        expect(theme()).toBe('dark');
    });
});
