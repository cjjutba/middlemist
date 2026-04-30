// @vitest-environment node
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { usersRepo } from '../../../src/lib/repositories/users.repo';
import { disconnectDb, resetDb } from '../../db';
import { createTestUser } from '../../factories';

describe('usersRepo', () => {
  beforeEach(async () => {
    await resetDb();
  });

  afterAll(async () => {
    await disconnectDb();
  });

  it('findByEmail returns the row when present, null otherwise (case-normalized)', async () => {
    const user = await createTestUser({ email: 'present@test.local' });
    expect(await usersRepo.findByEmail('present@test.local')).toMatchObject({ id: user.id });
    // Case-normalization: schema email is lowercased; lookup also lowercases.
    expect(await usersRepo.findByEmail('PRESENT@test.local')).toMatchObject({ id: user.id });
    expect(await usersRepo.findByEmail('absent@test.local')).toBeNull();
  });

  it('findById returns null for unknown id', async () => {
    expect(await usersRepo.findById('definitely-not-a-real-id')).toBeNull();
  });

  it('setPasswordHash updates the hash AND bumps passwordVersion', async () => {
    const user = await createTestUser({ name: 'Original Name' });
    expect(user.passwordVersion).toBe(0);

    await usersRepo.setPasswordHash(user.id, 'new-hash-value');

    const after = await usersRepo.findById(user.id);
    expect(after?.passwordHash).toBe('new-hash-value');
    expect(after?.passwordVersion).toBe(1);
    // Other fields untouched.
    expect(after?.name).toBe('Original Name');
  });

  it('setEmailVerifiedAt sets emailVerifiedAt on a previously-unverified user', async () => {
    const user = await createTestUser({ emailVerifiedAt: null });
    expect(user.emailVerifiedAt).toBeNull();

    await usersRepo.setEmailVerifiedAt(user.id);

    const after = await usersRepo.findById(user.id);
    expect(after?.emailVerifiedAt).not.toBeNull();
  });

  it('update changes profile fields without touching auth fields', async () => {
    const user = await createTestUser();
    const originalHash = user.passwordHash;

    const updated = await usersRepo.update(user.id, { businessName: 'Mango Studios' });
    expect(updated.businessName).toBe('Mango Studios');
    expect(updated.passwordHash).toBe(originalHash);
    expect(updated.passwordVersion).toBe(0);
  });

  it('two users do not collide on email when stored case-normalized', async () => {
    const a = await createTestUser({ email: 'shared@test.local' });
    // Try to insert via repo with the same email in different case.
    await expect(
      usersRepo.create({
        name: 'Dup',
        email: 'SHARED@test.local',
        passwordHash: 'x',
      }),
    ).rejects.toThrow();
    // a still exists.
    expect(await usersRepo.findById(a.id)).not.toBeNull();
  });
});
