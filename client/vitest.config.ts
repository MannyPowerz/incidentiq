import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Separate from vite.config.ts on purpose: that file's defineConfig takes a function so it can call
// loadEnv for the dev proxy, and tests need neither the proxy nor the env read.
export default defineConfig({
    plugins: [react()],
    test: {
        // RequireAuth renders and redirects, so it needs a DOM. The logic suites don't, but one
        // environment for the whole client is simpler than per-file overrides.
        environment: 'jsdom',
        globals: true,
        setupFiles: ['./src/test/setup.ts'],
        include: ['src/**/*.test.{ts,tsx}']
    }
});
