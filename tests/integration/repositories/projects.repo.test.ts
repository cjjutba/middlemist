// @vitest-environment node
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { projectsRepo } from '../../../src/lib/repositories/projects.repo';
import { disconnectDb, resetDb } from '../../db';
import { createTestClient, createTestProject, createTestUser } from '../../factories';

describe('projectsRepo (multi-tenant isolation)', () => {
  beforeEach(async () => {
    await resetDb();
  });

  afterAll(async () => {
    await disconnectDb();
  });

  describe('two-user isolation', () => {
    it('user A cannot see user B projects via list()', async () => {
      const userA = await createTestUser();
      const userB = await createTestUser();
      const aClient = await createTestClient(userA.id);
      const bClient = await createTestClient(userB.id);

      await createTestProject(userA.id, aClient.id, { name: 'A1' });
      await createTestProject(userA.id, aClient.id, { name: 'A2' });
      await createTestProject(userB.id, bClient.id, { name: 'B1' });

      const aProjects = await projectsRepo.list(userA.id);
      const bProjects = await projectsRepo.list(userB.id);

      expect(aProjects.map((p) => p.name).sort()).toEqual(['A1', 'A2']);
      expect(bProjects.map((p) => p.name)).toEqual(['B1']);
    });

    it('user A cannot read user B project via findById()', async () => {
      const userA = await createTestUser();
      const userB = await createTestUser();
      const bClient = await createTestClient(userB.id);
      const bProject = await createTestProject(userB.id, bClient.id);

      const result = await projectsRepo.findById(userA.id, bProject.id);
      expect(result).toBeNull();
    });

    it('user A cannot update user B project', async () => {
      const userA = await createTestUser();
      const userB = await createTestUser();
      const bClient = await createTestClient(userB.id);
      const bProject = await createTestProject(userB.id, bClient.id, { name: 'B1' });

      await expect(projectsRepo.update(userA.id, bProject.id, { name: 'hacked' })).rejects.toThrow(
        'PROJECT_NOT_FOUND',
      );

      const stillB = await projectsRepo.findById(userB.id, bProject.id);
      expect(stillB?.name).toBe('B1');
    });

    it('user A cannot setStatus on user B project', async () => {
      const userA = await createTestUser();
      const userB = await createTestUser();
      const bClient = await createTestClient(userB.id);
      const bProject = await createTestProject(userB.id, bClient.id, { status: 'active' });

      await expect(projectsRepo.setStatus(userA.id, bProject.id, 'completed')).rejects.toThrow(
        'PROJECT_NOT_FOUND',
      );

      const stillB = await projectsRepo.findById(userB.id, bProject.id);
      expect(stillB?.status).toBe('active');
    });

    it('user A cannot archive user B project', async () => {
      const userA = await createTestUser();
      const userB = await createTestUser();
      const bClient = await createTestClient(userB.id);
      const bProject = await createTestProject(userB.id, bClient.id);

      await expect(projectsRepo.archive(userA.id, bProject.id)).rejects.toThrow(
        'PROJECT_NOT_FOUND',
      );

      const stillB = await projectsRepo.findById(userB.id, bProject.id);
      expect(stillB?.archivedAt).toBeNull();
    });

    it('create() blocks attaching a project to another tenant client', async () => {
      const userA = await createTestUser();
      const userB = await createTestUser();
      const bClient = await createTestClient(userB.id);

      await expect(
        projectsRepo.create(userA.id, {
          clientId: bClient.id,
          name: 'Sneaky',
          currency: 'USD',
        }),
      ).rejects.toThrow('CLIENT_NOT_FOUND');

      expect(await projectsRepo.list(userA.id)).toHaveLength(0);
      expect(await projectsRepo.list(userB.id)).toHaveLength(0);
    });
  });

  describe('happy paths', () => {
    it('list() returns own projects ordered by updatedAt desc', async () => {
      const user = await createTestUser();
      const client = await createTestClient(user.id);
      const p1 = await createTestProject(user.id, client.id, { name: 'First' });
      await new Promise((r) => setTimeout(r, 10));
      const p2 = await createTestProject(user.id, client.id, { name: 'Second' });

      const result = await projectsRepo.list(user.id);
      expect(result.map((p) => p.id)).toEqual([p2.id, p1.id]);
    });

    it('list() respects status filter (single and array)', async () => {
      const user = await createTestUser();
      const client = await createTestClient(user.id);
      await createTestProject(user.id, client.id, { name: 'Active', status: 'active' });
      await createTestProject(user.id, client.id, { name: 'Hold', status: 'on_hold' });
      await createTestProject(user.id, client.id, { name: 'Done', status: 'completed' });

      const onlyActive = await projectsRepo.list(user.id, { status: 'active' });
      const activeOrHold = await projectsRepo.list(user.id, { status: ['active', 'on_hold'] });

      expect(onlyActive.map((p) => p.name)).toEqual(['Active']);
      expect(activeOrHold.map((p) => p.name).sort()).toEqual(['Active', 'Hold']);
    });

    it('list() respects clientId filter', async () => {
      const user = await createTestUser();
      const c1 = await createTestClient(user.id);
      const c2 = await createTestClient(user.id);
      await createTestProject(user.id, c1.id, { name: 'For C1' });
      await createTestProject(user.id, c2.id, { name: 'For C2' });

      const c1Projects = await projectsRepo.list(user.id, { clientId: c1.id });
      expect(c1Projects.map((p) => p.name)).toEqual(['For C1']);
    });

    it('listByClient returns the projects for a client only', async () => {
      const user = await createTestUser();
      const c1 = await createTestClient(user.id);
      const c2 = await createTestClient(user.id);
      await createTestProject(user.id, c1.id, { name: 'C1-A' });
      await createTestProject(user.id, c1.id, { name: 'C1-B' });
      await createTestProject(user.id, c2.id, { name: 'C2-A' });

      const c1Projects = await projectsRepo.listByClient(user.id, c1.id);
      expect(c1Projects.map((p) => p.name).sort()).toEqual(['C1-A', 'C1-B']);
    });

    it('create + setStatus + archive lifecycle', async () => {
      const user = await createTestUser();
      const client = await createTestClient(user.id);
      const created = await projectsRepo.create(user.id, {
        clientId: client.id,
        name: 'New Project',
        currency: 'USD',
      });
      expect(created.userId).toBe(user.id);
      expect(created.status).toBe('active');

      const onHold = await projectsRepo.setStatus(user.id, created.id, 'on_hold');
      expect(onHold.status).toBe('on_hold');

      await projectsRepo.archive(user.id, created.id);
      const archivedRow = await projectsRepo.findById(user.id, created.id);
      expect(archivedRow?.archivedAt).not.toBeNull();
    });
  });

  describe('archived-state-semantics', () => {
    it('archive() on already-archived row throws PROJECT_ALREADY_ARCHIVED', async () => {
      const user = await createTestUser();
      const client = await createTestClient(user.id);
      const project = await createTestProject(user.id, client.id);
      await projectsRepo.archive(user.id, project.id);

      await expect(projectsRepo.archive(user.id, project.id)).rejects.toThrow(
        'PROJECT_ALREADY_ARCHIVED',
      );
    });

    it('unarchive() on non-archived row throws PROJECT_NOT_ARCHIVED', async () => {
      const user = await createTestUser();
      const client = await createTestClient(user.id);
      const project = await createTestProject(user.id, client.id);

      await expect(projectsRepo.unarchive(user.id, project.id)).rejects.toThrow(
        'PROJECT_NOT_ARCHIVED',
      );
    });

    it('update() on archived row throws PROJECT_ARCHIVED and does not mutate', async () => {
      const user = await createTestUser();
      const client = await createTestClient(user.id);
      const project = await createTestProject(user.id, client.id, { name: 'Frozen' });
      await projectsRepo.archive(user.id, project.id);

      await expect(projectsRepo.update(user.id, project.id, { name: 'Edited' })).rejects.toThrow(
        'PROJECT_ARCHIVED',
      );

      const reread = await projectsRepo.findById(user.id, project.id);
      expect(reread?.name).toBe('Frozen');
    });

    it('setStatus() on archived row throws PROJECT_ARCHIVED', async () => {
      const user = await createTestUser();
      const client = await createTestClient(user.id);
      const project = await createTestProject(user.id, client.id, { status: 'active' });
      await projectsRepo.archive(user.id, project.id);

      await expect(projectsRepo.setStatus(user.id, project.id, 'on_hold')).rejects.toThrow(
        'PROJECT_ARCHIVED',
      );
    });

    it('archive() on a non-existent id throws PROJECT_NOT_FOUND (not ALREADY_ARCHIVED)', async () => {
      const user = await createTestUser();

      await expect(projectsRepo.archive(user.id, 'no-such-project-id')).rejects.toThrow(
        'PROJECT_NOT_FOUND',
      );
    });

    it('unarchive() on a non-existent id throws PROJECT_NOT_FOUND (not NOT_ARCHIVED)', async () => {
      const user = await createTestUser();

      await expect(projectsRepo.unarchive(user.id, 'no-such-project-id')).rejects.toThrow(
        'PROJECT_NOT_FOUND',
      );
    });
  });
});
