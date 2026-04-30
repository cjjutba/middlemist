// @vitest-environment node
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { writeAudit } from '../../../src/lib/audit/write';
import { prisma } from '../../../src/lib/prisma';
import { disconnectDb, resetDb } from '../../db';
import { createTestUser } from '../../factories';

describe('writeAudit (multi-tenant isolation + registry validation)', () => {
  beforeEach(async () => {
    await resetDb();
  });

  afterAll(async () => {
    await disconnectDb();
  });

  it('AuditLog rows are scoped by userId', async () => {
    const userA = await createTestUser();
    const userB = await createTestUser();

    await writeAudit({
      userId: userA.id,
      action: 'user.signup',
      entityType: 'user',
      entityId: userA.id,
    });
    await writeAudit({
      userId: userB.id,
      action: 'user.signup',
      entityType: 'user',
      entityId: userB.id,
    });
    await writeAudit({
      userId: userA.id,
      action: 'user.password-changed',
      entityType: 'user',
      entityId: userA.id,
    });

    const aLog = await prisma.auditLog.findMany({
      where: { userId: userA.id },
      orderBy: { createdAt: 'asc' },
    });
    const bLog = await prisma.auditLog.findMany({
      where: { userId: userB.id },
      orderBy: { createdAt: 'asc' },
    });

    expect(aLog).toHaveLength(2);
    expect(aLog.map((e) => e.action)).toEqual(['user.signup', 'user.password-changed']);
    expect(bLog).toHaveLength(1);
    expect(bLog[0]?.action).toBe('user.signup');
    expect(bLog[0]?.entityId).toBe(userB.id);
  });

  it('rejects unknown audit actions (registry guard)', async () => {
    const user = await createTestUser();

    await expect(
      writeAudit({
        userId: user.id,
        action: 'user.does-not-exist',
        entityType: 'user',
        entityId: user.id,
      }),
    ).rejects.toThrow('Unknown audit action: user.does-not-exist');
  });

  it('rejects malformed metadata for actions with a metadata schema', async () => {
    const user = await createTestUser();

    // user.email-changed requires { from, to } emails
    await expect(
      writeAudit({
        userId: user.id,
        action: 'user.email-changed',
        entityType: 'user',
        entityId: user.id,
        metadata: { from: 'not-an-email' },
      }),
    ).rejects.toThrow();
  });

  it('accepts valid metadata for user.email-changed', async () => {
    const user = await createTestUser();

    await writeAudit({
      userId: user.id,
      action: 'user.email-changed',
      entityType: 'user',
      entityId: user.id,
      metadata: { from: 'old@example.com', to: 'new@example.com' },
    });

    const row = await prisma.auditLog.findFirst({
      where: { userId: user.id, action: 'user.email-changed' },
    });
    expect(row).not.toBeNull();
    expect(row?.metadata).toEqual({ from: 'old@example.com', to: 'new@example.com' });
  });

  it('null userId is permitted (public-link views)', async () => {
    const user = await createTestUser();

    // Use a known action; null userId represents an unauth public-link viewer.
    // proposal.viewed isn't in the registry yet — use an existing action and
    // null userId.
    await writeAudit({
      userId: null,
      action: 'user.signup',
      entityType: 'user',
      entityId: user.id,
      ip: '203.0.113.1',
      userAgent: 'curl/8',
    });

    const row = await prisma.auditLog.findFirst({
      where: { entityId: user.id, userId: null },
    });
    expect(row).not.toBeNull();
    expect(row?.ip).toBe('203.0.113.1');
    expect(row?.userAgent).toBe('curl/8');
  });
});
