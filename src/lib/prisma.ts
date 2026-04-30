import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma';
import { env } from './env';

/**
 * Prisma client singleton.
 *
 * This is the ONLY file in the project allowed to import from the Prisma
 * client. Repositories in src/lib/repositories/ import `prisma` from here.
 * Direct Prisma access from anywhere else is forbidden by the
 * no-restricted-imports ESLint rule (see eslint.config.mjs and
 * docs/engineering/repository-pattern.md).
 *
 * Prisma 7 requires a driver adapter or Accelerate URL (the internal Rust
 * query engine was retired). We use @prisma/adapter-pg with node-postgres
 * for both local Docker Postgres and Neon in production.
 *
 * The singleton pattern is required because Next.js HMR would otherwise
 * create a new PrismaClient on every change, eventually exhausting the
 * database connection pool.
 *
 * See docs/architecture/multi-tenancy.md for why every repository function
 * takes userId as its first argument.
 */

declare global {
  var __prisma: PrismaClient | undefined;
}

function makePrismaClient(): PrismaClient {
  const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });
  return new PrismaClient({
    adapter,
    log: env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });
}

export const prisma: PrismaClient = globalThis.__prisma ?? makePrismaClient();

if (env.NODE_ENV !== 'production') {
  globalThis.__prisma = prisma;
}
