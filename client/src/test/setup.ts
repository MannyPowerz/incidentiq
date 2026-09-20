import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { setAccessToken } from '../auth/tokenStore';

// tokenStore is a module-level variable, so it survives between tests in the same file the same way
// it survives between components at runtime. Clearing it here is the client's equivalent of the
// server suite's TRUNCATE in tests/setup.ts — without it, one test's token leaks into the next.
afterEach(() => {
    cleanup();
    setAccessToken(null);
    vi.restoreAllMocks();
});
