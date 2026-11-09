// backend/src/objects/object-deletion.service.spec.ts
// ⭐ №246: удаление объекта — срок, права, получатели копий.
import { ForbiddenException } from '@nestjs/common';
import { AccessRole } from '@prisma/client';
import {
  DELETION_GRACE_DAYS,
  ObjectDeletionService,
  copyRecipients,
  deletionDaysLeft,
  projectIdsForParticipant,
} from './object-deletion.service';

const mockPrisma = () => ({
  objectAccess: { findFirst: jest.fn() },
  object: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    delete: jest.fn(),
  },
  $transaction: jest.fn(),
});

describe('deletionDaysLeft', () => {
  const now = new Date('2026-11-09T12:00:00.000Z');
  it('ровно 30 дней → 30, меньше суток → 1, просрочено → 0', () => {
    expect(deletionDaysLeft(new Date(now.getTime() + 30 * 86_400_000), now)).toBe(30);
    expect(deletionDaysLeft(new Date(now.getTime() + 12 * 3_600_000), now)).toBe(1);
    expect(deletionDaysLeft(new Date(now.getTime() - 1000), now)).toBe(0);
  });
});

describe('copyRecipients / projectIdsForParticipant', () => {
  const grants = [
    { userId: 1, projectId: null, role: AccessRole.CUSTOMER, hidePrices: false, isHidden: false, revokedAt: null },
    { userId: 2, projectId: null, role: AccessRole.FOREMAN, hidePrices: false, isHidden: false, revokedAt: null },
    { userId: 2, projectId: 10, role: AccessRole.FOREMAN, hidePrices: false, isHidden: false, revokedAt: null },
    { userId: 3, projectId: 11, role: AccessRole.VIEWER, hidePrices: true, isHidden: false, revokedAt: null },
    { userId: 4, projectId: null, role: AccessRole.FOREMAN, hidePrices: false, isHidden: false, revokedAt: new Date() },
  ];

  it('копии — всем активным, кроме инициатора; отозванные не в счёт', () => {
    expect(copyRecipients(grants, 1).sort()).toEqual([2, 3]);
    expect(copyRecipients(grants, null).sort()).toEqual([1, 2, 3]);
  });

  it('полный доступ → все проекты, точечный → только свои', () => {
    expect(projectIdsForParticipant(grants, 2)).toBeNull();
    expect(projectIdsForParticipant(grants, 3)).toEqual([11]);
  });
});

describe('ObjectDeletionService — права и срок', () => {
  let prisma: ReturnType<typeof mockPrisma>;
  let service: ObjectDeletionService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma = mockPrisma();
    service = new ObjectDeletionService(prisma as any);
    prisma.object.findUnique.mockResolvedValue({ id: 5 });
  });

  it('не админ объекта → 403, срок не ставится', async () => {
    prisma.objectAccess.findFirst.mockResolvedValue(null);
    await expect(service.schedule(5, 7)).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.object.update).not.toHaveBeenCalled();
  });

  it('админ ставит удаление на 30 дней', async () => {
    prisma.objectAccess.findFirst.mockResolvedValue({ id: 1 });
    const before = Date.now();
    const res = await service.schedule(5, 7);
    const call = prisma.object.update.mock.calls[0][0];
    expect(call.where).toEqual({ id: 5 });
    expect(call.data.deleteRequestedBy).toBe(7);
    const diffDays =
      (call.data.deleteAfter.getTime() - before) / 86_400_000;
    expect(Math.round(diffDays)).toBe(DELETION_GRACE_DAYS);
    expect(res.daysLeft).toBe(DELETION_GRACE_DAYS);
  });

  it('отмена очищает все три поля', async () => {
    prisma.objectAccess.findFirst.mockResolvedValue({ id: 1 });
    await service.cancel(5, 7);
    expect(prisma.object.update).toHaveBeenCalledWith({
      where: { id: 5 },
      data: { deleteRequestedAt: null, deleteAfter: null, deleteRequestedBy: null },
    });
  });

  it('purgeExpired без истёкших объектов ничего не делает', async () => {
    prisma.object.findMany.mockResolvedValue([]);
    await expect(service.purgeExpired()).resolves.toEqual({
      deleted: 0,
      copied: 0,
      failed: 0,
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
