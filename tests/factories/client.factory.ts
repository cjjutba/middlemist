import { clientsRepo } from '../../src/lib/repositories/clients.repo';

let clientCounter = 0;

export type CreateClientOverrides = {
  name?: string;
  email?: string;
  /** Schema field is `companyName`. */
  companyName?: string | null;
};

export async function createTestClient(userId: string, overrides: CreateClientOverrides = {}) {
  clientCounter += 1;
  return clientsRepo.create(userId, {
    name: overrides.name ?? `Test Client ${clientCounter}`,
    email: overrides.email ?? `client-${Date.now()}-${clientCounter}@test.local`,
    ...(overrides.companyName !== undefined ? { companyName: overrides.companyName } : {}),
  });
}
