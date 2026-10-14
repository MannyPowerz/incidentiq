/**
 * useRoomLog.test.tsx — the log keeps order, stamps each line, and caps its length so a long
 * incident cannot grow memory without bound.
 */

import { describe, it, expect } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { MAX_LOG_LINES, useRoomLog } from './useRoomLog';

describe('useRoomLog', () => {
    it('appends lines in order with increasing ids and an ISO timestamp', () => {
        const { result } = renderHook(() => useRoomLog());

        act(() => {
            result.current.log({ source: 'socket', level: 'info', message: 'one' });
            result.current.log({ source: 'room', level: 'ok', message: 'two' });
        });

        const [a, b] = result.current.lines;
        expect([a!.message, b!.message]).toEqual(['one', 'two']);
        expect(b!.id).toBeGreaterThan(a!.id);
        expect(new Date(a!.at).toISOString()).toBe(a!.at);
    });

    it(`keeps only the newest ${MAX_LOG_LINES} lines`, () => {
        const { result } = renderHook(() => useRoomLog());

        act(() => {
            for (let i = 1; i <= MAX_LOG_LINES + 5; i++) result.current.log({ source: 'room', level: 'info', message: `line ${i}` });
        });

        expect(result.current.lines).toHaveLength(MAX_LOG_LINES);
        expect(result.current.lines[0]!.message).toBe('line 6');
        expect(result.current.lines.at(-1)!.message).toBe(`line ${MAX_LOG_LINES + 5}`);
    });

    it('keeps the same log function across renders, so effects using it never re-run', () => {
        const { result, rerender } = renderHook(() => useRoomLog());
        const first = result.current.log;
        rerender();
        expect(result.current.log).toBe(first);
    });
});
