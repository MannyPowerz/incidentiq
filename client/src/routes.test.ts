/**
 * routes.test.ts — no page URL may start with a path the dev proxy forwards to the API.
 *
 * The API mounts at the root with no /api prefix (ADR 0010), and vite.config.ts forwards every
 * path starting with a mount to the server. A page there works when reached by a link (client-side
 * navigation) and returns raw JSON on reload or from a shared URL, which no unit test of the page
 * can see. This happened once, with a page at /fingerprints. This test reads both files so the
 * next one fails here instead.
 */

import { describe, it, expect } from 'vitest';
import appSource from './App.tsx?raw';
import viteConfigSource from '../vite.config.ts?raw';

// the quoted keys of the proxy block, e.g. '/auth': httpOrigin
const proxied = [...viteConfigSource.matchAll(/'(\/[\w.-]+)'\s*:/g)].map((m) => m[1]!);
// every <Route path="..."> in the app
const routes = [...appSource.matchAll(/<Route\s+path="([^"]+)"/g)].map((m) => m[1]!);

const clashes = (route: string) => proxied.filter((prefix) => route === prefix || route.startsWith(prefix + '/') || route.startsWith(prefix + '?'));

describe('page routes vs the API proxy', () => {
    // guards the guard: if either regex stops matching, this test must fail rather than pass on empty lists
    it('finds the proxied API paths and the app routes it is checking', () => {
        expect(proxied).toEqual(expect.arrayContaining(['/auth', '/incidents', '/fingerprints', '/socket.io']));
        expect(routes).toEqual(expect.arrayContaining(['/rooms', '/rooms/:roomId', '/machines']));
    });

    it.each(routes)('page route %s does not start with a proxied API path', (route) => {
        expect(clashes(route)).toEqual([]);
    });
});
