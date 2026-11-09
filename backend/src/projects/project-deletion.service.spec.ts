// backend/src/projects/project-deletion.service.spec.ts
// ⭐ №249: удаление проекта — срок, права, отсутствие ложных срабатываний.
import { ForbiddenException } from '@nestjs/common';
import { AccessRole } from '@prisma/client';
import { ProjectDeletionService } from './project-deletion.service';

const mockPrisma = () => ({
  project: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  objectAccess: { findFirst: jest.fn() },
  $transaction: jest.fn(),
});

describe('ProjectDeletionService', () => {
  let prisma: ReturnType<typeof mockPrisma>;
  let service: ProjectDeletionService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma = mockPrisma();
    service = new ProjectDeletionService(prisma as any, {} as any);
    prisma.project.findUnique.mockResolvedValue({ objectId: 3 });
  });

  it('не админ объекта → 403, срок не ставится', async () => {
    prisma.objectAccess.findFirst.mockResolvedValue(null);
    await expect(service.schedule(10, 7)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(prisma.project.update).not.toHaveBeenCalled();
  });

  it('админ ставит удаление ровно на 30 дней', async () => {
    prisma.objectAccess.findFirst.mockResolvedValue({
      id: 1,
      role: AccessRole.CUSTOMER,
    });
    const before = Date.now();
    const res = await service.schedule(10, 7);
    const call = prisma.project.update.mock.calls[0][0];
    expect(call.where).toEqual({ id: 10 });
    expect(call.data.deleteRequestedBy).toBe(7);
    const days = (call.data.deleteAfter.getTime() - before) / 86_400_000;
    expect(Math.round(days)).toBe(30);
    expect(res.daysLeft).toBe(30);
  });

  it('отмена очищает срок', async () => {
    prisma.objectAccess.findFirst.mockResolvedValue({ id: 1 });
    await service.cancel(10, 7);
    expect(prisma.project.update).toHaveBeenCalledWith({
      where: { id: 10 },
      data: {
        deleteRequestedAt: null,
        deleteAfter: null,
        deleteRequestedBy: null,
      },
    });
  });

  it('purgeExpired без истёкших проектов ничего не делает', async () => {
    prisma.project.findMany.mockResolvedValue([]);
    await expect(service.purgeExpired()).resolves.toEqual({
      deleted: 0,
      copied: 0,
      failed: 0,
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
