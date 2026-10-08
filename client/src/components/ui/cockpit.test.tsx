/**
 * cockpit.test.tsx — the four real-time primitives added in the dark redesign: TopBar, LiveDot,
 * Presence, Metric. Behavior and accessibility, not markup.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { LiveDot, Metric, Presence, TopBar } from './index';

const LINKS = [
    { to: '/rooms', label: 'Rooms' },
    { to: '/fingerprints', label: 'Fingerprints' },
];

function renderBar(path: string, right?: React.ReactNode) {
    return render(
        <MemoryRouter initialEntries={[path]}>
            <Routes>
                <Route path="*" element={<TopBar links={LINKS} right={right} />} />
            </Routes>
        </MemoryRouter>,
    );
}

describe('TopBar', () => {
    it('marks the current route as the active link', () => {
        renderBar('/fingerprints');
        const active = screen.getByRole('link', { name: 'Fingerprints' });
        expect(active.getAttribute('aria-current')).toBe('page');
        expect(screen.getByRole('link', { name: 'Rooms' }).getAttribute('aria-current')).toBeNull();
    });

    it('renders one sliding indicator only when a link is active', () => {
        const { container, unmount } = renderBar('/rooms');
        expect(container.querySelectorAll('.ui-topbar__indicator')).toHaveLength(1);
        unmount();
        const { container: none } = renderBar('/somewhere-else');
        expect(none.querySelectorAll('.ui-topbar__indicator')).toHaveLength(0);
    });

    it('is the floating layer: a landmark header with the glass class and a labelled nav', () => {
        renderBar('/rooms');
        expect(screen.getByRole('banner').className).toContain('ui-glass');
        expect(screen.getByRole('navigation', { name: 'Primary' })).toBeTruthy();
    });

    it('renders the right slot', () => {
        renderBar('/rooms', <button>Sign out</button>);
        expect(screen.getByRole('button', { name: 'Sign out' })).toBeTruthy();
    });
});

describe('LiveDot', () => {
    it('is a status with a visible label and a state class', () => {
        render(<LiveDot state="live" label="Scanner running" />);
        const status = screen.getByRole('status');
        expect(status.textContent).toBe('Scanner running');
        expect(status.className).toContain('ui-livedot--live');
    });

    // the dot alone is never the only signal — hidden labels stay in the accessibility tree
    it('keeps the label for screen readers when hidden visually', () => {
        render(<LiveDot state="failing" label="Agent offline" hideLabel />);
        expect(screen.getByRole('status').textContent).toBe('Agent offline');
        expect(screen.getByText('Agent offline').className).toBe('ui-sr-only');
    });

    it('falls back to a state label when none is given', () => {
        render(<LiveDot state="syncing" label="" />);
        expect(screen.getByRole('status').textContent).toBe('Syncing');
    });
});

describe('Presence', () => {
    const users = [
        { id: 1, label: 'Manny Hailu' },
        { id: 2, label: 'anthony@example.com' },
        { id: 3, label: 'Gabriella' },
    ];

    it('shows initials and names everyone in the accessible label', () => {
        render(<Presence users={users} />);
        expect(screen.getByRole('group').getAttribute('aria-label')).toBe('3 in room: Manny Hailu, anthony@example.com, Gabriella');
        expect(screen.getByText('MH')).toBeTruthy();
        expect(screen.getByText('A')).toBeTruthy();
        expect(screen.getByText('G')).toBeTruthy();
    });

    it('collapses the overflow into a +N chip', () => {
        render(<Presence users={users} max={2} />);
        expect(screen.getByText('+1')).toBeTruthy();
        expect(screen.queryByText('G')).toBeNull();
    });

    it('gives the same user the same color every render', () => {
        const { container, unmount } = render(<Presence users={[users[0]!]} />);
        const first = (container.querySelector('.ui-presence__chip') as HTMLElement).style.getPropertyValue('--presence-hue');
        unmount();
        const { container: again } = render(<Presence users={[users[0]!]} />);
        expect((again.querySelector('.ui-presence__chip') as HTMLElement).style.getPropertyValue('--presence-hue')).toBe(first);
    });
});

describe('Metric', () => {
    it('renders label, value, and detail', () => {
        render(<Metric label="Open incidents" value={7} detail="2 P1" tone="danger" />);
        expect(screen.getByText('Open incidents')).toBeTruthy();
        expect(screen.getByText('7').className).toContain('ui-metric__value');
        expect(screen.getByText('2 P1')).toBeTruthy();
    });
});
