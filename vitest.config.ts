import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules', '.next', 'e2e/**/*', '**/e2e/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules',
        '.next',
        'vitest.config.ts',
        'vitest.setup.ts',
        // Pure-types modules (`type`-only re-exports + interfaces)
        // can never be exercised at runtime — exclude so they don't
        // drag down the average.
        'src/**/types.ts',
        'src/**/*.d.ts',
        // Test scaffolding directories.
        'src/**/__tests__/**',
        'e2e/**',
      ],
      // CI floor — locks current overall coverage so a future drop
      // breaks the build instead of silently rotting. Run
      // `npm run test:coverage` to see the live numbers; bump these
      // as coverage rises rather than chasing the floor.
      // Live baseline 2026-04-25: lines 63.77 / branches 50.93 /
      // functions 59.23 / statements 63.28 (commit e209053).
      thresholds: {
        lines: 60,
        branches: 48,
        functions: 55,
        statements: 60,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
