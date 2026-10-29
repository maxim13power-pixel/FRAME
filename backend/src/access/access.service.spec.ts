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

  // ⭐ №207: «прораб-менеджер» упразднён — команда только у администратора объекта
  it('прораб с правом создавать проекты не получает список участников ⇒ ForbiddenException', async () => {
    prisma.objectAccess.findFirst.mockReset();
    prisma.objectAccess.findFirst.mockResolvedValue({
      ...adminGrant,
      role: 'FOREMAN',
      canCreateProjects: true,
    });

    await expect(service.getAccessList(3, 7)).rejects.toThrow(ForbiddenException);
  });

  it('понижение при наличии другого администратора ⇒ проходит', async () => {
    prisma.objectAccess.count.mockResolvedValue(1);

    await service.updateAccess(3, 2, { role: 'FOREMAN' } as any, 7);

    expect(prisma.objectAccess.update).toHaveBeenCalled();
  });

  it('выдача права создавать проекты не требует проверки «последний админ»', async () => {
    await service.updateAccess(3, 2, { canCreateProjects: true } as any, 7);

    expect(prisma.objectAccess.update).toHaveBeenCalled();
    expect(prisma.objectAccess.count).not.toHaveBeenCalled();
  });

  // ⭐ №207: видимость цен фиксируется приглашением и через updateAccess не меняется
  it('updateAccess не меняет hidePrices (только роль и право создавать проекты)', async () => {
    await service.updateAccess(
      3,
      2,
      { role: 'FOREMAN', hidePrices: true } as any,
      7,
    );

    const data = prisma.objectAccess.update.mock.calls[0][0].data;
    expect(data).not.toHaveProperty('hidePrices');
    expect(data.role).toBe('FOREMAN');
  });

  // ⭐ №182/№207: делегирование цен проверяется на приглашении
  it('нельзя пригласить с открытыми ценами, если у актора они скрыты ⇒ ForbiddenException', async () => {
    prisma.objectAccess.findFirst
      .mockReset()
      .mockResolvedValue({ ...adminGrant, hidePrices: true });

    await expect(
      service.addAccess(
        3,
        { email: 'worker@frame.app', role: 'FOREMAN', hidePrices: false } as any,
        7,
      ),
    ).rejects.toThrow(/скрыты цены/);
  });

  // ⭐ №207: удаление участника — жёсткое, но с защитой от самоудаления
  it('нельзя удалить собственный доступ ⇒ BadRequestException', async () => {
    prisma.objectAccess.findFirst
      .mockReset()
      .mockResolvedValueOnce({ ...adminGrant })
      .mockResolvedValueOnce({ ...adminGrant, id: 5, userId: 7 });

    await expect(service.removeParticipant(3, 5, 7)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('нельзя удалить последнего администратора объекта ⇒ BadRequestException', async () => {
    prisma.objectAccess.findFirst
      .mockReset()
      .mockResolvedValueOnce({ ...adminGrant })
      .mockResolvedValueOnce({ ...adminGrant, id: 2, userId: 9 });
    prisma.objectAccess.count.mockResolvedValue(0);

    await expect(service.removeParticipant(3, 2, 7)).rejects.toThrow(
      BadRequestException,
    );
  });
});
