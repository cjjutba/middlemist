// @vitest-environment node
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { clientsRepo } from '../../../src/lib/repositories/clients.repo';
import { disconnectDb, resetDb } from '../../db';
import { createTestClient, createTestUser } from '../../factories';

describe('clientsRepo (multi-tenant isolation)', () => {
  beforeEach(async () => {
    await resetDb();
  });

  afterAll(async () => {
    await disconnectDb();
  });

  describe('two-user isolation', () => {
    it('user A cannot see user B clients via list()', async () => {
      const userA = await createTestUser();
      const userB = await createTestUser();

      await createTestClient(userA.id, { name: 'A1' });
      await createTestClient(userA.id, { name: 'A2' });
      await createTestClient(userB.id, { name: 'B1' });

      const aClients = await clientsRepo.list(userA.id);
      const bClients = await clientsRepo.list(userB.id);

      expect(aClients.map((c) => c.name).sort()).toEqual(['A1', 'A2']);
      expect(bClients.map((c) => c.name)).toEqual(['B1']);
    });

    it('user A cannot read user B client via findById()', async () => {
      const userA = await createTestUser();
      const userB = await createTestUser();
      const bClient = await createTestClient(userB.id, { name: 'B1' });

      const result = await clientsRepo.findById(userA.id, bClient.id);
      expect(result).toBeNull();
    });

    it('user A cannot update user B client via update()', async () => {
      const userA = await createTestUser();
      const userB = await createTestUser();
      const bClient = await createTestClient(userB.id, { name: 'B1' });

      await expect(clientsRepo.update(userA.id, bClient.id, { name: 'hacked' })).rejects.toThrow(
        'CLIENT_NOT_FOUND',
      );

      const stillB = await clientsRepo.findById(userB.id, bClient.id);
      expect(stillB?.name).toBe('B1');
    });

    it('user A cannot archive user B client', async () => {
      const userA = await createTestUser();
      const userB = await createTestUser();
      const bClient = await createTestClient(userB.id, { name: 'B1' });

      await expect(clientsRepo.archive(userA.id, bClient.id)).rejects.toThrow('CLIENT_NOT_FOUND');

      const stillB = await clientsRepo.findById(userB.id, bClient.id);
      expect(stillB?.archivedAt).toBeNull();
    });

    it('user A cannot unarchive user B client', async () => {
      const userA = await createTestUser();
      const userB = await createTestUser();
      const bClient = await createTestClient(userB.id, { name: 'B1' });
      await clientsRepo.archive(userB.id, bClient.id);

      await expect(clientsRepo.unarchive(userA.id, bClient.id)).rejects.toThrow('CLIENT_NOT_FOUND');

      const stillB = await clientsRepo.findById(userB.id, bClient.id);
      expect(stillB?.archivedAt).not.toBeNull();
    });
  });

  describe('happy paths', () => {
    it('list() returns own clients ordered by name asc', async () => {
      const user = await createTestUser();
      await createTestClient(user.id, { name: 'Charlie' });
      await createTestClient(user.id, { name: 'Alice' });
      await createTestClient(user.id, { name: 'Bob' });

      const result = await clientsRepo.list(user.id);
      expect(result.map((c) => c.name)).toEqual(['Alice', 'Bob', 'Charlie']);
    });

    it('list() default excludes archived; includeArchived: true returns all', async () => {
      const user = await createTestUser();
      const active = await createTestClient(user.id, { name: 'Active' });
      const stale = await createTestClient(user.id, { name: 'Archived' });
      await clientsRepo.archive(user.id, stale.id);

      const defaultList = await clientsRepo.list(user.id);
      const includeAll = await clientsRepo.list(user.id, { includeArchived: true });

      expect(defaultList.map((c) => c.id)).toEqual([active.id]);
      expect(includeAll.map((c) => c.id).sort()).toEqual([active.id, stale.id].sort());
    });

    it('list() supports search by name, companyName, email (case-insensitive)', async () => {
      const user = await createTestUser();
      await createTestClient(user.id, {
        name: 'Acme Corp',
        email: 'a@acme.test',
        companyName: 'Acme LLC',
      });
      await createTestClient(user.id, { name: 'Beta Inc', email: 'b@beta.test' });

      const byName = await clientsRepo.list(user.id, { search: 'acme' });
      expect(byName.map((c) => c.name)).toEqual(['Acme Corp']);

      const byEmail = await clientsRepo.list(user.id, { search: 'beta.test' });
      expect(byEmail.map((c) => c.name)).toEqual(['Beta Inc']);

      const byCompany = await clientsRepo.list(user.id, { search: 'acme llc' });
      expect(byCompany.map((c) => c.name)).toEqual(['Acme Corp']);
    });

    it('create + findById + update + archive lifecycle', async () => {
      const user = await createTestUser();
      const created = await clientsRepo.create(user.id, {
        name: 'New Client',
        email: 'new@client.test',
      });
      expect(created.userId).toBe(user.id);

      const found = await clientsRepo.findById(user.id, created.id);
      expect(found?.name).toBe('New Client');

      const updated = await clientsRepo.update(user.id, created.id, { name: 'Renamed' });
      expect(updated.name).toBe('Renamed');

      await clientsRepo.archive(user.id, created.id);
      const archivedRow = await clientsRepo.findById(user.id, created.id);
      expect(archivedRow?.archivedAt).not.toBeNull();

      await clientsRepo.unarchive(user.id, created.id);
      const unarchivedRow = await clientsRepo.findById(user.id, created.id);
      expect(unarchivedRow?.archivedAt).toBeNull();
    });
  });
});
