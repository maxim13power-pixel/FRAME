// backend/src/access/access.service.spec.ts
// ⭐ №181: последнего администратора объекта нельзя понизить (инвариант «≥1 администратор»).
// ⭐ №203 (F11): список участников с контактами — только тем, кто управляет командой.
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { AccessService } from './access.service';

describe('AccessService — понижение последнего администратора (№181)', () => {
  const prisma = {
    objectAccess: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
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
    // ⭐ Важно: mockClear не чистит очередь mockResolvedValueOnce — сбрасываем явно,
    // иначе «неиспользованные» ответы одного теста утекают в следующий.
    prisma.objectAccess.findFirst.mockReset();
    prisma.objectAccess.findMany.mockReset();
    prisma.objectAccess.count.mockReset();
    prisma.objectAccess.update.mockReset();
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

  // ⭐ №203 (F11): контакты участников (e-mail/телефон) — только управляющим
  it('наблюдатель не получает список участников ⇒ ForbiddenException', async () => {
    prisma.objectAccess.findFirst.mockReset();
    prisma.objectAccess.findFirst.mockResolvedValue({
      ...adminGrant,
      role: 'VIEWER',
      isManager: false,
    });

    await expect(service.getAccessList(3, 7)).rejects.toThrow(ForbiddenException);
  });

  it('прораб без isManager не получает список участников ⇒ ForbiddenException', async () => {
    prisma.objectAccess.findFirst.mockReset();
    prisma.objectAccess.findFirst.mockResolvedValue({
      ...adminGrant,
      role: 'FOREMAN',
      isManager: false,
    });

    await expect(service.getAccessList(3, 7)).rejects.toThrow(ForbiddenException);
  });

  it('прораб-менеджер получает список участников', async () => {
    prisma.objectAccess.findFirst.mockReset();
    prisma.objectAccess.findFirst
      .mockResolvedValueOnce({ ...adminGrant, role: 'FOREMAN', isManager: true })
      .mockResolvedValueOnce({ ...adminGrant, role: 'FOREMAN', isManager: true });
    prisma.objectAccess.findMany.mockResolvedValue([{ id: 1 }]);

    await expect(service.getAccessList(3, 7)).resolves.toEqual([{ id: 1 }]);
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
