/**
 * Timeline.test.tsx — the relevance line's wording. The reader is the person being flagged
 * (server/src/relevance/types.ts ReasonFor), so "you" is addressed directly and "nobody" is a
 * sentence rather than a blank gap.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Timeline from './Timeline';
import type { RelevanceLine, TimelineEntry } from '../../api';

const entry = (id: number): TimelineEntry => ({
    id,
    incident_id: 5,
    author_id: 4,
    type: 'observation',
    body: { text: `entry ${id}` },
    locked: false,
    created_at: new Date().toISOString(),
});
const line = (user_id: number, reason = 'Changed these files yesterday.'): RelevanceLine => ({ user_id, reason, score: 0.6 });

const notes = () => [...document.querySelectorAll('.timeline__relevance-text')].map((el) => el.textContent);

describe('Timeline relevance line', () => {
    it('names a teammate, addresses you directly, and says so when nobody has touched the files', () => {
        const relevance = new Map<number, RelevanceLine | null>([
            [1, line(2)],
            [2, line(9, 'Wrote most of this module.')],
            [3, null],
        ]);
        render(<Timeline entries={[entry(1), entry(2), entry(3)]} currentUserId={9} relevance={relevance} />);

        expect(notes()).toEqual([
            'Ask User #2: Changed these files yesterday.',
            "You're closest to this: Wrote most of this module.",
            'Nobody on the team has touched these files yet.',
        ]);
    });

    // invented data must never read as a real claim about a real teammate
    it('tags every line as sample data while the source is a fixture', () => {
        render(<Timeline entries={[entry(1), entry(2)]} currentUserId={null} relevance={new Map([[1, line(2)], [2, null]])} />);

        expect(screen.getAllByText('sample')).toHaveLength(2);
    });

    it('shows no line for an entry whose relevance is not known yet', () => {
        render(<Timeline entries={[entry(1), entry(2)]} currentUserId={null} relevance={new Map([[1, line(2)]])} />);

        expect(notes()).toEqual(['Ask User #2: Changed these files yesterday.']);
    });

    it('renders no relevance at all when the page passes none', () => {
        render(<Timeline entries={[entry(1)]} currentUserId={null} />);

        expect(notes()).toEqual([]);
    });
});

describe('Timeline real-time states', () => {
    const entryLis = () => [...document.querySelectorAll('ol.timeline > li')];
    const by = (author: number | null, id: number): TimelineEntry => ({ ...entry(id), author_id: author });

    it('animates only entries that arrive after the first render', () => {
        const { rerender } = render(<Timeline entries={[by(4, 1), by(4, 2)]} currentUserId={9} />);
        expect(entryLis().some((li) => li.classList.contains('timeline__entry--new'))).toBe(false);

        rerender(<Timeline entries={[by(4, 1), by(4, 2), by(4, 3)]} currentUserId={9} />);

        const [first, second, third] = entryLis();
        expect(first!.classList.contains('timeline__entry--new')).toBe(false);
        expect(second!.classList.contains('timeline__entry--new')).toBe(false);
        expect(third!.classList.contains('timeline__entry--new')).toBe(true);
    });

    it("flashes a teammate's arrival but only slides in your own", () => {
        const { rerender } = render(<Timeline entries={[by(4, 1)]} currentUserId={9} />);

        rerender(<Timeline entries={[by(4, 1), by(4, 2), by(9, 3)]} currentUserId={9} />);

        const [, teammate, mine] = entryLis();
        expect(teammate!.classList.contains('timeline__entry--incoming')).toBe(true);
        expect(mine!.classList.contains('timeline__entry--new')).toBe(true);
        expect(mine!.classList.contains('timeline__entry--incoming')).toBe(false);
    });

    it('shows your in-flight post last, labeled as sending, and busy', () => {
        render(<Timeline entries={[by(4, 1)]} currentUserId={9} pending={{ type: 'action', text: 'Restarted the VPN' }} />);

        const last = entryLis().at(-1)!;
        expect(last.classList.contains('timeline__entry--sending')).toBe(true);
        expect(last.getAttribute('aria-busy')).toBe('true');
        expect(last.textContent).toContain('Restarted the VPN');
        expect(last.textContent).toContain('Sending');
    });

    it('shows a pending post instead of the empty state on an empty room', () => {
        render(<Timeline entries={[]} currentUserId={9} pending={{ type: 'observation', text: 'first!' }} />);

        expect(screen.queryByText('No entries yet')).toBeNull();
        expect(screen.getByText('first!')).toBeTruthy();
    });
});

