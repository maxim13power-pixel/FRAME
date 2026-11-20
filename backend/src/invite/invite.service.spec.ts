// backend/src/invite/invite.service.spec.ts
// ⭐ №180: нельзя приглашать с ролью выше своей; отозванный доступ приглашать не может.
import { ForbiddenException } from '@nestjs/common';
import { InviteService } from './invite.service';
import { CreateInviteDto } from './dto/create-invite.dto';

// nanoid v6 — ESM-модуль: jest его не трансформирует, подменяем фабрикой.
jest.mock('nanoid', () => ({ nanoid: () => 'test-token' }));

describe('InviteService — выдача ролей (№180)', () => {
  const prisma = {
    objectAccess: { findFirst: jest.fn() },
    object: { findUnique: jest.fn() },
    project: { findFirst: jest.fn() },
    inviteToken: { create: jest.fn() },
  };

  let service: InviteService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new InviteService(prisma as any);
    prisma.object.findUnique.mockResolvedValue({ id: 1, name: 'Объект' });
    prisma.inviteToken.create.mockResolvedValue({ id: 99, token: 'tok' });
  });

  const givenAccess = (role: string, revokedAt: Date | null = null) => {
    prisma.objectAccess.findFirst.mockResolvedValue({
      id: 1,
      role,
      hidePrices: false,
      revokedAt,
    });
  };

  const dto = (role: string) => ({ role } as CreateInviteDto);

  it('прораб не может выпустить ссылку с ролью CUSTOMER', async () => {
    givenAccess('FOREMAN');

    await expect(
      service.createInviteLink(1, dto('CUSTOMER'), 7),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.inviteToken.create).not.toHaveBeenCalled();
  });

  it('прораб может выпустить ссылку с ролью FOREMAN', async () => {
    givenAccess('FOREMAN');

    await service.createInviteLink(1, dto('FOREMAN'), 7);

    expect(prisma.inviteToken.create).toHaveBeenCalled();
  });

  it('CUSTOMER может выпустить ссылку с ролью CUSTOMER', async () => {
    givenAccess('CUSTOMER');

    await service.createInviteLink(1, dto('CUSTOMER'), 7);

    expect(prisma.inviteToken.create).toHaveBeenCalled();
  });

  it('отозванный доступ не может создавать ссылки', async () => {
    givenAccess('FOREMAN', new Date('2026-10-01'));

    await expect(
      service.createInviteLink(1, dto('FOREMAN'), 7),
    ).rejects.toThrow(/Доступ отозван/);
    expect(prisma.inviteToken.create).not.toHaveBeenCalled();
  });

  // ⭐ №250: ссылка в конкретный проект
  it('админ объекта выпускает ссылку с projectId', async () => {
    givenAccess('CUSTOMER');
    prisma.project.findFirst.mockResolvedValue({ id: 5 });

    await service.createInviteLink(
      1,
      { role: 'FOREMAN', projectId: 5 } as CreateInviteDto,
      7,
    );

    expect(prisma.project.findFirst).toHaveBeenCalledWith({
      where: { id: 5, objectId: 1 },
      select: { id: true },
    });
    expect(prisma.inviteToken.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ projectId: 5 }),
      }),
    );
  });

  it('прораб не может выпустить ссылку в проект', async () => {
    givenAccess('FOREMAN');

    await expect(
      service.createInviteLink(
        1,
        { role: 'FOREMAN', projectId: 5 } as CreateInviteDto,
        7,
      ),
    ).rejects.toThrow(/администратор объекта/);
    expect(prisma.inviteToken.create).not.toHaveBeenCalled();
  });
  // ⭐ №303: «разрешить создавать проекты» по ссылке
  it('админ выпускает ссылку прорабу с правом создавать проекты', async () => {
    givenAccess('CUSTOMER');

    await service.createInviteLink(
      1,
      { role: 'FOREMAN', canCreateProjects: true } as CreateInviteDto,
      7,
    );

    expect(prisma.inviteToken.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ canCreateProjects: true }),
      }),
    );
  });

  it('право создавать проекты не выдаётся для ссылки в проект и для не-прораба', async () => {
    givenAccess('CUSTOMER');
    prisma.project.findFirst.mockResolvedValue({ id: 5 });

    await service.createInviteLink(
      1,
      { role: 'FOREMAN', projectId: 5, canCreateProjects: true } as CreateInviteDto,
      7,
    );
    expect(
      prisma.inviteToken.create.mock.calls[0][0].data.canCreateProjects,
    ).toBe(false);

    await service.createInviteLink(
      1,
      { role: 'VIEWER', canCreateProjects: true } as CreateInviteDto,
      7,
    );
    expect(
      prisma.inviteToken.create.mock.calls[1][0].data.canCreateProjects,
    ).toBe(false);
  });

  it('прораб не может выдать по ссылке право создавать проекты', async () => {
    givenAccess('FOREMAN');

    await expect(
      service.createInviteLink(
        1,
        { role: 'FOREMAN', canCreateProjects: true } as CreateInviteDto,
        7,
      ),
    ).rejects.toThrow(/только администратор объекта/);
    expect(prisma.inviteToken.create).not.toHaveBeenCalled();
  });

  // ⭐ №345: срок жизни по умолчанию — 2 часа; «Администратор» не для ссылки в проект
  it('по умолчанию ссылка живёт 2 часа', async () => {
    givenAccess('CUSTOMER');
    const before = Date.now();

    await service.createInviteLink(1, { role: 'FOREMAN' } as CreateInviteDto, 7);

    const data = prisma.inviteToken.create.mock.calls[0][0].data;
    const hours = (data.expiresAt.getTime() - before) / 3_600_000;
    expect(Math.round(hours)).toBe(2);
  });

  it('для ссылки в проект роль «Администратор» недоступна', async () => {
    givenAccess('CUSTOMER');
    prisma.project.findFirst.mockResolvedValue({ id: 5 });

    await expect(
      service.createInviteLink(
        1,
        { role: 'CUSTOMER', projectId: 5 } as CreateInviteDto,
        7,
      ),
    ).rejects.toThrow(/Прораб.*Наблюдатель/);
    expect(prisma.inviteToken.create).not.toHaveBeenCalled();
  });
});
