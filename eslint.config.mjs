import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import prettier from 'eslint-config-prettier';

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores(['.next/**', 'out/**', 'build/**', 'next-env.d.ts', 'src/generated/**']),
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/lib/repositories/**', 'src/lib/prisma.ts', 'src/actions/auth.ts', 'prisma/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '@prisma/client',
                '@prisma/client/**',
                '@/lib/prisma',
                '@/generated/prisma',
                '@/generated/prisma/**',
              ],
              message:
                'Direct Prisma imports are forbidden outside src/lib/repositories. Use a repository function (see docs/engineering/repository-pattern.md).',
            },
          ],
        },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  prettier,
]);

export default eslintConfig;
