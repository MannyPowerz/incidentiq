/**
 * RoomLog.test.tsx — the panel renders each line with its time, source and level, and stays
 * quiet for screen readers because the page already announces arrivals once.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import RoomLog from './RoomLog';
import type { LogLine } from '../../hooks/useRoomLog';

const line = (id: number, over: Partial<LogLine> = {}): LogLine => ({
    id,
    at: '2026-10-14T14:05:09.000Z',
    level: 'info',
    source: 'socket',
    message: `event ${id}`,
    ...over,
});

describe('RoomLog', () => {
    it('says it is waiting before anything has happened', () => {
        render(<RoomLog lines={[]} />);
        expect(screen.getByText(/Waiting for activity/)).toBeTruthy();
        expect(screen.getByText('waiting')).toBeTruthy();
    });

    it('renders each line with its source and level, oldest first', () => {
        render(<RoomLog lines={[line(1), line(2, { level: 'error', source: 'ai', message: 'Draft failed' })]} />);

        const items = screen.getByRole('log').querySelectorAll('.room-log__line');
        expect(items).toHaveLength(2);
        expect(items[1]!.classList.contains('room-log__line--error')).toBe(true);
        expect(items[1]!.querySelector('.room-log__source')!.textContent).toBe('ai');
        expect(items[1]!.querySelector('.room-log__message')!.textContent).toBe('Draft failed');
        expect(screen.getByText('2 events')).toBeTruthy();
    });

    // the page's polite region already announces arrivals; a speaking log would say everything twice
    it('is a log region that does not announce', () => {
        render(<RoomLog lines={[line(1)]} />);
        expect(screen.getByRole('log').getAttribute('aria-live')).toBe('off');
    });
});
