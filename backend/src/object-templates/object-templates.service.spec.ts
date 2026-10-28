// backend/src/object-templates/object-templates.service.spec.ts
// ⭐ №192: шаблон проекта — доступ к проекту (или ко всему объекту), не VIEWER, не отозванный.
import {
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ObjectTemplatesService } from './object-templates.service';
import { CreateObjectTemplateDto } from './dto/create-object-template.dto';

describe('ObjectTemplatesService.createFromObject (№192)', () => {
  const prisma = {
    objectAccess: { findFirst: jest.fn(), findMany: jest.fn() },
    object: { findUnique: jest.fn() },
    objectTemplate: { create: jest.fn() },
  };

  let service: ObjectTemplatesService;

  const projectGrant = (over: Record<string, unknown> = {}) => ({
    id: 1,
    objectId: 15,
    projectId: 29,
    role: 'FOREMAN',
    hidePrices: false,
    isManager: false,
    isHidden: false,
    revokedAt: null as Date | null,
    ...over,
  });

  const objectWithProject = {
    id: 15,
    name: 'ЖК Северный парк',
    note: null,
    projects: [
      {
        id: 29,
        name: 'Монолит',
        note: null,
        materials: [{ id: 1, name: 'Бетон', unit: 'PIECE', specQuantity: 5 }],
      },
    ],
  };

  const dto = (over: Partial<CreateObjectTemplateDto> = {}) =>
    ({ objectId: 15, ...over }) as CreateObjectTemplateDto;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ObjectTemplatesService(prisma as any, {} as any, {
      log: jest.fn(),
    } as any);
    prisma.object.findUnique.mockResolvedValue(objectWithProject);
    prisma.objectTemplate.create.mockResolvedValue({
      id: 7,
      name: 'ЖК Северный парк → Монолит',
      projects: [{ materials: [{ id: 1 }] }],
    });
  });

  it('участник проекта снимает шаблон с этого проекта', async () => {
    prisma.objectAccess.findMany.mockResolvedValue([projectGrant()]);

    await service.createFromObject(15, dto({ projectId: 29 }), 7);

    const call = prisma.objectTemplate.create.mock.calls[0][0];
    expect(call.data.name).toBe('ЖК Северный парк → Монолит');
    expect(prisma.object.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          projects: expect.objectContaining({ where: { id: 29 } }),
        }),
      }),
    );
  });

  it('участник всего объекта тоже может снять шаблон с проекта', async () => {
    prisma.objectAccess.findMany.mockResolvedValue([
      projectGrant({ projectId: null, role: 'CUSTOMER' }),
    ]);

    await service.createFromObject(15, dto({ projectId: 29 }), 7);

    expect(prisma.objectTemplate.create).toHaveBeenCalled();
  });

  it('наблюдатель на проекте ⇒ ForbiddenException', async () => {
    prisma.objectAccess.findMany.mockResolvedValue([
      projectGrant({ role: 'VIEWER' }),
    ]);

    await expect(
      service.createFromObject(15, dto({ projectId: 29 }), 7),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.objectTemplate.create).not.toHaveBeenCalled();
  });

  it('отозванный доступ к проекту ⇒ ForbiddenException', async () => {
    prisma.objectAccess.findMany.mockResolvedValue([
      projectGrant({ revokedAt: new Date('2026-10-01') }),
    ]);

    await expect(
      service.createFromObject(15, dto({ projectId: 29 }), 7),
    ).rejects.toThrow(/Доступ отозван/);
  });

  it('чужой проект ⇒ ForbiddenException', async () => {
    prisma.objectAccess.findMany.mockResolvedValue([
      projectGrant({ projectId: 30 }),
    ]);

    await expect(
      service.createFromObject(15, dto({ projectId: 29 }), 7),
    ).rejects.toThrow(ForbiddenException);
  });

  it('проекта нет в объекте ⇒ NotFoundException', async () => {
    prisma.objectAccess.findMany.mockResolvedValue([projectGrant()]);
    prisma.object.findUnique.mockResolvedValue({
      ...objectWithProject,
      projects: [],
    });

    await expect(
      service.createFromObject(15, dto({ projectId: 29 }), 7),
    ).rejects.toThrow(NotFoundException);
  });

  it('шаблон ВСЕГО объекта по-прежнему требует доступ на весь объект', async () => {
    prisma.objectAccess.findFirst.mockResolvedValue(null);

    await expect(service.createFromObject(15, dto(), 7)).rejects.toThrow(
      ForbiddenException,
    );
    expect(prisma.objectTemplate.create).not.toHaveBeenCalled();
  });
});
