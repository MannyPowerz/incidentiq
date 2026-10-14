/**
 * useRelevance.test.tsx — per-entry lookups against a mocked getRelevance. The case that matters
 * most is a new entry arriving while earlier lookups are still in flight: a per-run "cancelled"
 * flag would throw those earlier results away and leave their entries without a line forever.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import { getRelevance } from '../api';
import type { RelevanceLine } from '../api';
import { useRelevance } from './useRelevance';

vi.mock('../api', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../api')>()),
    getRelevance: vi.fn(),
}));

const line = (user_id: number): RelevanceLine => ({ user_id, reason: `reason for ${user_id}`, score: 0.5 });

function Harness({ incidentId, ids }: { incidentId: number | null; ids: number[] }) {
    const byId = useRelevance(incidentId, ids);
    const shown = [...byId.entries()].sort(([a], [b]) => a - b).map(([id, l]) => `${id}:${l ? l.user_id : 'none'}`);
    return <p data-testid="out">{shown.join(',')}</p>;
}
const out = () => screen.getByTestId('out').textContent;

// a promise the test resolves by hand, to hold a lookup in flight
function deferred<T>() {
    let resolve!: (v: T) => void;
    let reject!: (e: unknown) => void;
    const promise = new Promise<T>((res, rej) => ((resolve = res), (reject = rej)));
    return { promise, resolve, reject };
}

beforeEach(() => vi.mocked(getRelevance).mockReset());

describe('useRelevance', () => {
    it('looks up each entry once and keeps "nobody" as a real answer', async () => {
        vi.mocked(getRelevance).mockImplementation(async (_i, id) => (id === 2 ? null : line(id + 10)));
        render(<Harness incidentId={5} ids={[1, 2]} />);

        await waitFor(() => expect(out()).toBe('1:11,2:none'));
        expect(getRelevance).toHaveBeenCalledTimes(2);
        expect(getRelevance).toHaveBeenCalledWith(5, 1);
    });

    it('asks only about the new entry when one arrives', async () => {
        vi.mocked(getRelevance).mockImplementation(async (_i, id) => line(id));
        const { rerender } = render(<Harness incidentId={5} ids={[1, 2]} />);
        await waitFor(() => expect(out()).toBe('1:1,2:2'));

        rerender(<Harness incidentId={5} ids={[1, 2, 3]} />);

        await waitFor(() => expect(out()).toBe('1:1,2:2,3:3'));
        expect(getRelevance).toHaveBeenCalledTimes(3);
    });

    it('keeps a lookup that was still in flight when a new entry arrived', async () => {
        const first = deferred<RelevanceLine | null>();
        vi.mocked(getRelevance).mockImplementation((_i, id) => (id === 1 ? first.promise : Promise.resolve(line(id))));
        const { rerender } = render(<Harness incidentId={5} ids={[1]} />);

        rerender(<Harness incidentId={5} ids={[1, 2]} />);
        await waitFor(() => expect(out()).toBe('2:2'));
        await act(async () => first.resolve(line(7)));

        expect(out()).toBe('1:7,2:2');
    });

    it('leaves a failed lookup without a line, and retries it on the next change', async () => {
        vi.mocked(getRelevance)
            .mockRejectedValueOnce(new Error('down'))
            .mockImplementation(async (_i, id) => line(id));
        const { rerender } = render(<Harness incidentId={5} ids={[1]} />);
        await waitFor(() => expect(getRelevance).toHaveBeenCalledTimes(1));
        expect(out()).toBe('');

        rerender(<Harness incidentId={5} ids={[1, 2]} />);

        await waitFor(() => expect(out()).toBe('1:1,2:2'));
    });

    it('starts over for a different room and drops answers that arrive late for the old one', async () => {
        const late = deferred<RelevanceLine | null>();
        vi.mocked(getRelevance).mockImplementation((incident, id) => (incident === 5 ? late.promise : Promise.resolve(line(id + 100))));
        const { rerender } = render(<Harness incidentId={5} ids={[1]} />);

        rerender(<Harness incidentId={6} ids={[1]} />);
        await waitFor(() => expect(out()).toBe('1:101'));
        await act(async () => late.resolve(line(999)));

        expect(out()).toBe('1:101');
    });

    it('asks nothing until there is a room', () => {
        render(<Harness incidentId={null} ids={[1, 2]} />);

        expect(getRelevance).not.toHaveBeenCalled();
    });
});
