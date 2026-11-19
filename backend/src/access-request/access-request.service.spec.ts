// backend/src/access-request/access-request.service.spec.ts
// ⭐ №340: заявку на право создавать проекты подаёт любой участник, у которого этого
// права НЕТ. Раньше прораб с доступом на весь объект (без флага) получал «уже есть право».
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { AccessRequestService } from './access-request.service';

const grant = (patch: Record<string, unknown> = {}) => ({
  id: 1,
  objectId: 10,
  projectId: null as number | null,
  role: 'FOREMAN',
  hidePrices: false,
  canCreateProjects: false,
  isHidden: false,
  revokedAt: null as Date | null,
  ...patch,
});

const makeService = (grants: Record<string, unknown>[]) => {
  const prisma = {
    object: {
      findUnique: jest.fn().mockResolvedValue({ id: 10, name: 'Объект' }),
    },
    objectAccess: { findMany: jest.fn().mockResolvedValue(grants) },
    accessRequest: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 99, status: 'PENDING' }),
    },
  };
  const audit = { log: jest.fn() };
  return {
    service: new AccessRequestService(prisma as never, audit as never),
    prisma,
  };
};

describe('AccessRequestService — заявка на право создавать проекты (№340)', () => {
  it('прораб с объектным доступом без флага может подать заявку', async () => {
    const { service, prisma } = makeService([grant()]);

    await service.create(10, {}, 5);

    expect(prisma.accessRequest.create).toHaveBeenCalledTimes(1);
  });

  it('участник одного проекта тоже может подать заявку', async () => {
    const { service, prisma } = makeService([
      grant({ projectId: 7, canCreateProjects: false }),
    ]);

    await service.create(10, {}, 5);

    expect(prisma.accessRequest.create).toHaveBeenCalledTimes(1);
  });

  it('администратор объекта получает «уже есть право»', async () => {
    const { service, prisma } = makeService([
      grant({ role: 'CUSTOMER', canCreateProjects: true }),
    ]);

    await expect(service.create(10, {}, 5)).rejects.toThrow(
      BadRequestException,
    );
    expect(prisma.accessRequest.create).not.toHaveBeenCalled();
  });

  it('прораб с флагом canCreateProjects получает «уже есть право»', async () => {
    const { service } = makeService([
      grant({ role: 'FOREMAN', canCreateProjects: true }),
    ]);

    await expect(service.create(10, {}, 5)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('наблюдатель не может запрашивать права', async () => {
    const { service } = makeService([grant({ role: 'VIEWER' })]);

    await expect(service.create(10, {}, 5)).rejects.toThrow(ForbiddenException);
  });

  it('отозванный доступ — заявку подать нельзя', async () => {
    const { service } = makeService([grant({ revokedAt: new Date() })]);

    await expect(service.create(10, {}, 5)).rejects.toThrow(ForbiddenException);
  });
});
