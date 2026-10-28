// backend/src/snapshots/snapshots.service.spec.ts
// ⭐ №194: снимок видит только владелец; чужой id = «не найдено».
import { NotFoundException } from '@nestjs/common';
import { SnapshotsService } from './snapshots.service';

describe('SnapshotsService (№194)', () => {
  const prisma = {
    accessSnapshot: { findMany: jest.fn(), findFirst: jest.fn() },
  };
  let service: SnapshotsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new SnapshotsService(prisma as never);
  });

  it('listMine — только свои снимки, новые сверху, без тяжёлого payload', async () => {
    prisma.accessSnapshot.findMany.mockResolvedValue([{ id: 1 }]);

    await service.listMine(7);

    expect(prisma.accessSnapshot.findMany).toHaveBeenCalledWith({
      where: { userId: 7 },
      orderBy: { takenAt: 'desc' },
      select: expect.objectContaining({ summary: true }),
    });
    const args = prisma.accessSnapshot.findMany.mock.calls[0][0];
    expect(args.select.payload).toBeUndefined();
  });

  it('getMine — свой снимок отдаётся', async () => {
    prisma.accessSnapshot.findFirst.mockResolvedValue({ id: 3, userId: 7 });

    await expect(service.getMine(7, 3)).resolves.toEqual({ id: 3, userId: 7 });
    expect(prisma.accessSnapshot.findFirst).toHaveBeenCalledWith({
      where: { id: 3, userId: 7 },
    });
  });

  it('getMine — чужой снимок ⇒ 404 (не подтверждаем существование)', async () => {
    prisma.accessSnapshot.findFirst.mockResolvedValue(null);

    await expect(service.getMine(7, 42)).rejects.toThrow(NotFoundException);
  });
});
