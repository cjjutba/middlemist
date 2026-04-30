// Load .env.test in the worker process. vitest.config.ts also loads it,
// but vitest's main config doesn't always propagate env to forked workers,
// so loading it here makes integration tests reliable.
import { config as loadEnv } from 'dotenv';

loadEnv({ path: '.env.test', override: true });

import '@testing-library/jest-dom/vitest';
