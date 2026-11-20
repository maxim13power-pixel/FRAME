// backend/src/invite/invite.last-admin.spec.ts
// ⭐ №354: нельзя оставить объект без администратора через ссылку-приглашение.
// (Владелец сам понизил себе роль, открыв свою же ссылку «Наблюдатель».)
import { BadRequestException } from '@nestjs/common';
import { InviteService } from './invite.service';

// nanoid v6 — ESM-модуль: jest его не трансформирует, подменяем фабрикой.
jest.mock('nanoid', () => ({ nanoid: () => 'test-token' }));

const makeTx = (overrides: Record<string, unknown> = {}) => {
  const objectGrant = {
    id: 11,
    projectId: null as number | null,
    role: 'CUSTOMER',
    hidePrices: false,
    canCreateProjects: false,
    revokedAt: null as Date | null,
  };
  const tx = {
    inviteToken: {
      findUnique: jest.fn().mockResolvedValue({
        id: 5,
        token: 'tok',
        objectId: 1,
        projectId: null,
        role: 'VIEWER',
        hidePrices: false,
        canCreateProjects: false,
        isActive: true,
        expiresAt: new Date(Date.now() + 3_600_000),
        maxUses: null,
        usesCount: 0,
        createdBy: 7,
        creator: { id: 7, fullName: 'Админ' },
        object: { id: 1, name: 'Объект' },
        project: null,
      }),
      update: jest.fn(),
    },
    objectAccess: {
      findMany: jest.fn().mockResolvedValue([{ ...objectGrant }]),
      count: jest.fn().mockResolvedValue(0),
      update: jest.fn(),
      create: jest.fn(),
      deleteMany: jest.fn(),
    },
    auditLog: { create: jest.fn() },
    project: { findMany: jest.fn().mockResolvedValue([]) },
    ...overrides,
  };
  return tx;
};

const makeService = (tx: ReturnType<typeof makeTx>) => {
  const prisma = {
    $transaction: jest.fn(async (cb: (t: unknown) => unknown) => cb(tx)),
  };
  return new InviteService(prisma as never);
};

describe('InviteService — последний администратор и ссылки (№354)', () => {
  it('последний CUSTOMER не понижается по объектной ссылке', async () => {
    const tx = makeTx();
    const service = makeService(tx);

    await expect(service.acceptInvite('tok', 7)).rejects.toThrow(
      BadRequestException,
    );
    expect(tx.objectAccess.update).not.toHaveBeenCalled();
  });

  it('если есть другой администратор — понижение по ссылке проходит', async () => {
    const tx = makeTx();
    tx.objectAccess.count.mockResolvedValue(1);
    const service = makeService(tx);

    const result = await service.acceptInvite('tok', 7);

    expect(tx.objectAccess.update).toHaveBeenCalled();
    expect(result).toMatchObject({ updated: true, role: 'VIEWER' });
  });

  it('статус ссылки для последнего администратора помечен blocked', async () => {
    const tx = makeTx();
    const service = makeService(tx);

    const status = await service.inviteStatus('tok', 7);

    expect(status).toMatchObject({ blocked: true });
    expect(status.alreadyHasAccess).toBe('object');
  });
});
