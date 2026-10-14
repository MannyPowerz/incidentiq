/**
 * tokenStore.test.ts — the module-level variable behaves like one shared value, and clears.
 *
 * Small on purpose. The only thing that can break here is the store ceasing to be shared, which
 * would silently split the token between importers and is invisible from any single call site.
 */

import { describe, it, expect } from 'vitest';
import { getAccessToken, getCurrentUserId, setAccessToken } from './tokenStore';

// a JWT-shaped string with the given payload; signature is junk because nothing here verifies it
const tokenWith = (payload: object) =>
    `h.${btoa(JSON.stringify(payload)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')}.sig`;

describe('tokenStore', () => {
    it('starts empty, which is what makes a reload log you out', () => {
        expect(getAccessToken()).toBeNull();
    });

    it('hands back what was stored', () => {
        setAccessToken('abc.def.ghi');

        expect(getAccessToken()).toBe('abc.def.ghi');
    });

    // null is a real value, not an absence: a failed refresh and a future logout both clear this way.
    it('clears back to null rather than keeping a stale token', () => {
        setAccessToken('abc.def.ghi');
        setAccessToken(null);

        expect(getAccessToken()).toBeNull();
    });

    // the whole reason this is a module and not useState — every importer reads one value.
    it('is shared across importers, not copied per import', async () => {
        setAccessToken('shared-token');
        const reimported = await import('./tokenStore');

        expect(reimported.getAccessToken()).toBe('shared-token');
    });
});

describe('getCurrentUserId', () => {
    it('reads sub, which the server signs as a string, back as a number', () => {
        setAccessToken(tokenWith({ sub: '42', org_id: 7 }));

        expect(getCurrentUserId()).toBe(42);
    });

    it('is null with no token, so "You" never shows for a signed-out tab', () => {
        expect(getCurrentUserId()).toBeNull();
    });

    it('is null for a token that does not parse, rather than throwing into a render', () => {
        setAccessToken('not-a-jwt');
        expect(getCurrentUserId()).toBeNull();

        setAccessToken('h.%%%.sig');
        expect(getCurrentUserId()).toBeNull();
    });
});
