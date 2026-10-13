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
