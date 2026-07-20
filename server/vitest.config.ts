import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globalSetup: './tests/globalSetup.ts',
    setupFiles: ['./tests/setup.ts'],
    // Test files share one Postgres pool that gets truncated between tests —
    // running files in parallel would let them stomp on each other's rows.
    fileParallelism: false,
  },
});
