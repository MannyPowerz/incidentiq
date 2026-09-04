/**
 * relevance.systemPaths.test.ts — the affected_system -> directories lookup.
 *
 * Pure function, no database. The interesting cases are the ones the map can't answer: null and
 * an unrecognized name, both of which have to return [] rather than throw, since scoreTeammates
 * treats an empty file_paths list as "score nobody" rather than an error.
 */

import { describe, expect, it } from 'vitest';
import { resolveFilePaths } from '../src/relevance/systemPaths.js';

describe('resolveFilePaths', () => {
    it('maps a known system name to its directory', () => {
        expect(resolveFilePaths('auth')).toEqual(['server/src/auth']);
    });

    // the one value actually used anywhere in this repo, from incidents.smoke.test.ts
    it('maps the one real-world example seen in this repo', () => {
        expect(resolveFilePaths('postgres')).toEqual(['server/src/db']);
    });

    it('is case-insensitive and trims whitespace, same as the email matching in score.ts', () => {
        expect(resolveFilePaths('  Auth  ')).toEqual(['server/src/auth']);
    });

    it('returns an empty array for null rather than throwing', () => {
        expect(resolveFilePaths(null)).toEqual([]);
    });

    it('returns an empty array for a system name with no known mapping', () => {
        expect(resolveFilePaths('some system nobody typed before')).toEqual([]);
    });

    // the agent maps a dead port to one of these two names (agent-architecture.md §10);
    // missing either one means an agent-created incident scores nobody.
    it('maps client and server, for the agent\'s port -> system mapping', () => {
        expect(resolveFilePaths('client')).toEqual(['client/src']);
        expect(resolveFilePaths('server')).toEqual(['server/src']);
    });
});
