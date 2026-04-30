import { config as loadEnv } from 'dotenv';
import { defineConfig } from 'prisma/config';

loadEnv({ path: '.env.local' });
loadEnv({ path: '.env' });

const url = process.env['DATABASE_URL'];
if (!url) {
  throw new Error('DATABASE_URL is required to run Prisma');
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: { url },
});
