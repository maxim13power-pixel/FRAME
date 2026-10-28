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
});
