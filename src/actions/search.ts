'use server';

import { z } from 'zod';
import { withAuth } from '@/lib/auth/with-auth';
import { clientsRepo } from '@/lib/repositories/clients.repo';
import { projectsRepo } from '@/lib/repositories/projects.repo';

const querySchema = z.object({
  q: z.string().trim().max(100),
});

export type SearchClientHit = {
  type: 'client';
  id: string;
  name: string;
  subtitle: string | null;
};

export type SearchProjectHit = {
  type: 'project';
  id: string;
  name: string;
  subtitle: string | null;
};

export type SearchResults = {
  clients: SearchClientHit[];
  projects: SearchProjectHit[];
};

const RESULT_LIMIT = 6;

/**
 * Cmd+K skeleton search: clients and projects only.
 *
 * Empty query returns the most recent items in each group (recents pattern).
 * Non-empty query filters by name (case-insensitive ILIKE under the hood,
 * via the existing repository search support).
 *
 * Full search (proposals, invoices, tasks, quick-actions) lands in week 15
 * per docs/spec/13-global-search.md.
 */
export const searchAll = withAuth(querySchema, async (userId, { q }) => {
  const [clients, projects] = await Promise.all([
    clientsRepo.list(userId, q ? { search: q } : {}),
    projectsRepo.list(userId, {
      includeArchived: false,
      ...(q ? { search: q } : {}),
      limit: RESULT_LIMIT,
    }),
  ]);

  const results: SearchResults = {
    clients: clients.slice(0, RESULT_LIMIT).map((c) => ({
      type: 'client',
      id: c.id,
      name: c.name,
      subtitle: c.companyName ?? c.email ?? null,
    })),
    projects: projects.slice(0, RESULT_LIMIT).map((p) => ({
      type: 'project',
      id: p.id,
      name: p.name,
      subtitle: null,
    })),
  };
  return results;
});
