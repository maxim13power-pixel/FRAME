// backend/src/access/access.service.spec.ts
// ⭐ №181: последнего администратора объекта нельзя понизить (инвариант «≥1 администратор»).
import { BadRequestException } from '@nestjs/common';
import { AccessService } from './access.service';

describe('AccessService — понижение последнего администратора (№181)', () => {
  const prisma = {
    objectAccess: {
      findFirst: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    },
  };
  const audit = { log: jest.fn() };
  let service: AccessService;

  const adminGrant = {
    id: 1,
    userId: 7,
    objectId: 3,
    projectId: null as number | null,
    role: 'CUSTOMER',
    isManager: false,
    revokedAt: null as Date | null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AccessService(prisma as any, audit as any);
    // 1-й findFirst — мой доступ (actor 7, администратор), 2-й — цель (userId 9)
    prisma.objectAccess.findFirst
      .mockResolvedValueOnce({ ...adminGrant })
      .mockResolvedValueOnce({ ...adminGrant, id: 2, userId: 9 });
    prisma.objectAccess.update.mockResolvedValue({ id: 2 });
  });

  it('понижение последнего администратора ⇒ BadRequestException', async () => {
    prisma.objectAccess.count.mockResolvedValue(0);

    await expect(
      service.updateAccess(3, 2, { role: 'FOREMAN' } as any, 7),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.objectAccess.update).not.toHaveBeenCalled();
  });

  it('понижение при наличии другого администратора ⇒ проходит', async () => {
    prisma.objectAccess.count.mockResolvedValue(1);

    await service.updateAccess(3, 2, { role: 'FOREMAN' } as any, 7);

    expect(prisma.objectAccess.update).toHaveBeenCalled();
  });

  it('смена isManager у последнего администратора не блокируется', async () => {
    await service.updateAccess(3, 2, { isManager: false } as any, 7);

    expect(prisma.objectAccess.update).toHaveBeenCalled();
  });

  // ⭐ №182: делегирование видимости цен
  it('нельзя открыть цены, если у самого актора они скрыты ⇒ ForbiddenException', async () => {
    prisma.objectAccess.findFirst
      .mockReset()
      .mockResolvedValueOnce({ ...adminGrant, hidePrices: true })
      .mockResolvedValueOnce({
        ...adminGrant,
        id: 2,
        userId: 9,
        hidePrices: false,
      });

    await expect(
      service.updateAccess(3, 2, { hidePrices: false } as any, 7),
    ).rejects.toThrow(/скрыты цены/);
    expect(prisma.objectAccess.update).not.toHaveBeenCalled();
  });

  it('скрыть цены участнику можно, и это попадает в журнал', async () => {
    prisma.objectAccess.findFirst
      .mockReset()
      .mockResolvedValueOnce({ ...adminGrant })
      .mockResolvedValueOnce({
        ...adminGrant,
        id: 2,
        userId: 9,
        hidePrices: false,
      });

    await service.updateAccess(3, 2, { hidePrices: true } as any, 7);

    expect(prisma.objectAccess.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ hidePrices: true }),
      }),
    );
    expect(audit.log).toHaveBeenCalledWith(
      7,
      'object_access',
      3,
      'update',
      expect.objectContaining({ hidePrices: false }),
      expect.objectContaining({ hidePrices: true }),
    );
  });
});
