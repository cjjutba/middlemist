import type { NextAuthConfig } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { z } from 'zod';
import { env } from '../env';
import { prisma } from '../prisma';
import { verifyPassword } from './password';

/**
 * Auth.js v5 configuration.
 *
 * Credentials-only provider (no OAuth in v1 per docs/spec/01-auth-and-account.md).
 * No Prisma adapter: with no OAuth and JWT sessions, the adapter would only
 * be load-bearing for OAuth account linking, which v1 doesn't need. The
 * credentials provider's authorize() does the user lookup directly.
 *
 * Email verification gate: an unverified account (emailVerifiedAt = null)
 * cannot pass authorize() even with the correct password.
 *
 * See docs/security/authentication.md for cookie posture, rolling expiry,
 * and the passwordVersion-based session-invalidation strategy.
 */

const loginSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(1).max(128),
});

export const authConfig: NextAuthConfig = {
  secret: env.AUTH_SECRET,
  session: {
    strategy: 'jwt',
    maxAge: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
  },
  cookies: {
    sessionToken: {
      name: env.NODE_ENV === 'production' ? '__Secure-middlemist.session' : 'middlemist.session',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        secure: env.NODE_ENV === 'production',
        path: '/',
      },
    },
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      authorize: async (credentials) => {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;

        const user = await prisma.user.findUnique({
          where: { email: email.toLowerCase().trim() },
        });
        if (!user || !user.passwordHash) return null;
        if (!user.emailVerifiedAt) {
          throw new Error('EMAIL_NOT_VERIFIED');
        }
        if (user.deletedAt) return null;

        const ok = await verifyPassword(password, user.passwordHash);
        if (!ok) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
        };
      },
    }),
  ],
  callbacks: {
    jwt: ({ token, user }) => {
      if (user) {
        token['userId'] = user.id;
      }
      return token;
    },
    session: ({ session, token }) => {
      const userId = token['userId'];
      if (typeof userId === 'string' && session.user) {
        session.user.id = userId;
      }
      return session;
    },
  },
};
