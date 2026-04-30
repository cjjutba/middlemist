import path from 'node:path';
import react from '@vitejs/plugin-react';
import { config as loadEnv } from 'dotenv';
import { defineConfig } from 'vitest/config';

// Load .env.test first (override: true so it wins over any inherited
// .env.local from a parent process). Vitest evaluates this config in the
// main process before forking workers, so process.env propagates to workers.
loadEnv({ path: '.env.test', override: true });

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    globals: true,
    passWithNoTests: true,
    // Integration tests share one Postgres test DB and reset it in
    // beforeEach. Run tests sequentially (no file-level parallelism) to
    // avoid races on the shared DB. When we move to per-test transactions
    // or schema-per-worker, this can be relaxed.
    pool: 'forks',
    fileParallelism: false,
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
});
