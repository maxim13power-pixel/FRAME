// backend/src/projects/projects.service.spec.ts
// ⭐ №204 (A#10): карточка проекта — объектное право, а не проектное.
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ProjectsService } from './projects.service';

const grant = (over: Record<string, unknown> = {}) => ({
  objectId: 15,
  projectId: null as number | null,
  role: 'FOREMAN',
  hidePrices: false,
  isManager: false,
  isHidden: false,
  revokedAt: null as Date | null,
  ...over,
});

describe('ProjectsService — карточка проекта (№204, A#10)', () => {
  const prisma = {
    project: {
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    objectAccess: { findMany: jest.fn() },
    material: { count: jest.fn() },
    report: { count: jest.fn() },
    warehouseTransaction: { count: jest.fn() },
    brigadeShift: { count: jest.fn() },
  };
  const audit = { log: jest.fn() };
  let service: ProjectsService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.project.findUnique.mockResolvedValue({ objectId: 15 });
    prisma.project.update.mockResolvedValue({ id: 29 });
    prisma.project.delete.mockResolvedValue({ id: 29 });
    prisma.material.count.mockResolvedValue(0);
    prisma.report.count.mockResolvedValue(0);
    prisma.warehouseTransaction.count.mockResolvedValue(0);
    prisma.brigadeShift.count.mockResolvedValue(0);
    audit.log.mockResolvedValue(undefined);
    service = new ProjectsService(prisma as never, audit as never);
  });

  it('участник ОДНОГО проекта не может переименовать проект ⇒ Forbidden', async () => {
    prisma.objectAccess.findMany.mockResolvedValue([grant({ projectId: 29 })]);

    await expect(service.update(29, { name: 'Новое имя' }, 7)).rejects.toThrow(
      ForbiddenException,
    );
    expect(prisma.project.update).not.toHaveBeenCalled();
  });

  it('наблюдатель на всём объекте карточку не меняет ⇒ Forbidden', async () => {
    prisma.objectAccess.findMany.mockResolvedValue([grant({ role: 'VIEWER' })]);

    await expect(service.update(29, { name: 'Новое имя' }, 7)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('участник всего объекта с правом записи меняет карточку', async () => {
    prisma.objectAccess.findMany.mockResolvedValue([grant()]);
    jest.spyOn(service, 'findOne').mockResolvedValue({ id: 29 } as never);

    await expect(service.update(29, { name: 'Новое имя' }, 7)).resolves.toBeTruthy();
    expect(prisma.project.update).toHaveBeenCalled();
  });

  it('прораб без isManager не удаляет проект ⇒ Forbidden (удаление — право администратора)', async () => {
    prisma.objectAccess.findMany.mockResolvedValue([grant()]);

    await expect(service.remove(29, 7)).rejects.toThrow(ForbiddenException);
    expect(prisma.project.delete).not.toHaveBeenCalled();
  });

  it('администратор объекта удаляет пустой проект', async () => {
    prisma.objectAccess.findMany.mockResolvedValue([grant({ role: 'CUSTOMER' })]);

    await expect(service.remove(29, 7)).resolves.toBeTruthy();
    expect(prisma.project.delete).toHaveBeenCalled();
  });
});
describe('ProjectsService — смета из другого проекта (№286)', () => {
  const prisma = {
    project: { findUnique: jest.fn(), findMany: jest.fn() },
    objectAccess: { findMany: jest.fn() },
    material: { count: jest.fn(), findMany: jest.fn(), createMany: jest.fn() },
  };
  const audit = { log: jest.fn() };
  let service: ProjectsService;

  beforeEach(() => {
    jest.clearAllMocks();
    // цель (29) и источник (12) лежат в объекте 15
    prisma.project.findUnique.mockResolvedValue({ objectId: 15 });
    prisma.objectAccess.findMany.mockResolvedValue([grant({ role: 'CUSTOMER' })]);
    prisma.material.count.mockResolvedValue(0);
    prisma.material.createMany.mockResolvedValue({ count: 1 });
    service = new ProjectsService(prisma as never, audit as never);
  });

  it('копирует позиции и цены, количества — как в источнике', async () => {
    prisma.material.findMany.mockResolvedValue([
      {
        name: 'Стена',
        article: 'A-1',
        unit: 'SQUARE_METER',
        specQuantity: 12.5,
        unitPrice: 300,
        materialUnitPrice: 200,
        priceItemId: 5,
        materialItemId: 6,
      },
    ]);

    await expect(
      service.copyEstimate(29, { sourceProjectId: 12 }, 7),
    ).resolves.toEqual({ created: 1 });

    const data = prisma.material.createMany.mock.calls[0][0].data[0];
    expect(data).toMatchObject({
      specQuantity: 12.5,
      unitPrice: 300,
      materialUnitPrice: 200,
      priceItemId: 5,
      materialItemId: 6,
      projectId: 29,
      isSpecLocked: true,
    });
  });

  it('zeroQuantities обнуляет количества, названия и единицы остаются', async () => {
    prisma.material.findMany.mockResolvedValue([
      {
        name: 'Стена',
        article: null,
        unit: 'PIECE',
        specQuantity: 7,
        unitPrice: 10,
        materialUnitPrice: 0,
        priceItemId: null,
        materialItemId: null,
      },
    ]);

    await service.copyEstimate(29, { sourceProjectId: 12, zeroQuantities: true }, 7);

    const data = prisma.material.createMany.mock.calls[0][0].data[0];
    expect(data.specQuantity).toBe(0);
    expect(data.name).toBe('Стена');
  });

  it('в проект с позициями не копирует ⇒ BadRequest', async () => {
    prisma.material.count.mockResolvedValue(3);

    await expect(
      service.copyEstimate(29, { sourceProjectId: 12 }, 7),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.material.createMany).not.toHaveBeenCalled();
  });

  it('append в непустую смету добавляет позиции (№290)', async () => {
    prisma.material.count.mockResolvedValue(3); // в смете уже есть строки
    prisma.material.findMany.mockResolvedValue([
      {
        name: 'Стена',
        article: null,
        unit: 'PIECE',
        specQuantity: 7,
        unitPrice: 10,
        materialUnitPrice: 0,
        priceItemId: null,
        materialItemId: null,
      },
    ]);

    await expect(
      service.copyEstimate(29, { sourceProjectId: 12, append: true }, 7),
    ).resolves.toEqual({ created: 1 });
    expect(prisma.material.createMany).toHaveBeenCalled();
  });

  it('наблюдатель смету копировать не может ⇒ Forbidden', async () => {
    prisma.objectAccess.findMany.mockResolvedValue([grant({ role: 'VIEWER' })]);

    await expect(
      service.copyEstimate(29, { sourceProjectId: 12 }, 7),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.material.createMany).not.toHaveBeenCalled();
  });

  it('список для копирования: без пустых смет и объектов в личном архиве', async () => {
    prisma.objectAccess.findMany.mockResolvedValue([
      grant({ projectId: null, isHidden: false }),
      grant({ objectId: 16, projectId: null, isHidden: true }),
    ]);
    prisma.project.findMany.mockResolvedValue([
      { id: 29, name: 'Смета A', objectId: 15, object: { name: 'Объект' }, _count: { materials: 4 } },
      { id: 30, name: 'Пустой', objectId: 15, object: { name: 'Объект' }, _count: { materials: 0 } },
      { id: 31, name: 'Из архива', objectId: 16, object: { name: 'Архив' }, _count: { materials: 2 } },
    ]);

    const rows = await service.listAvailableForCopy(7);

    expect(rows).toEqual([
      { id: 29, name: 'Смета A', objectId: 15, objectName: 'Объект', materialsCount: 4 },
    ]);
  });
});

// ⭐ №307: копия проекта внутри объекта
describe('ProjectsService — копия проекта (№307)', () => {
  const prisma = {
    project: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    material: { createMany: jest.fn() },
    projectHidden: { findUnique: jest.fn() },
    objectAccess: { findFirst: jest.fn(), findMany: jest.fn() },
    $transaction: jest.fn(),
  };
  const audit = { log: jest.fn() };
  let service: ProjectsService;

  const sourceProject = {
    id: 29,
    name: 'Смета A',
    objectId: 15,
    startDate: new Date('2026-11-01'),
    endDate: new Date('2026-12-01'),
    catalogId: 4,
    note: 'старая заметка',
    materials: [
      {
        name: 'Стяжка',
        article: 'A-1',
        unit: 'SQUARE_METER',
        specQuantity: 10,
        totalUsed: 5,
        lastEntry: 2,
        lastEntryDate: new Date('2026-11-10'),
        note: 'комментарий',
        progressPercent: 50,
        isSpecLocked: true,
        priceItemId: 7,
        unitPrice: 100,
        materialItemId: 8,
        materialUnitPrice: 40,
      },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.project.findUnique.mockResolvedValue(sourceProject);
    prisma.project.create.mockResolvedValue({ id: 99 });
    prisma.material.createMany.mockResolvedValue({ count: 1 });
    prisma.projectHidden.findUnique.mockResolvedValue(null);
    // Доступ к проекту (findProjectAccess) и к объекту (findLiveAccess)
    prisma.objectAccess.findMany.mockResolvedValue([
      grant({ projectId: 29, role: 'CUSTOMER' }),
    ]);
    prisma.objectAccess.findFirst.mockResolvedValue(grant({ role: 'CUSTOMER' }));
    // Транзакция просто прогоняет колбэк на тех же моках
    prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
      fn({ project: prisma.project, material: prisma.material }),
    );
    service = new ProjectsService(prisma as never, audit as never);
    jest.spyOn(service, 'findOne').mockResolvedValue({ id: 99, name: 'Копия' } as never);
  });

  it('без copyFacts копия «чистая»: план и цены есть, факт и прогресс = 0', async () => {
    const result = await service.copyProject(29, { name: 'Смета A (копия)' }, 7);

    const rows = prisma.material.createMany.mock.calls[0][0].data;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      name: 'Стяжка',
      specQuantity: 10,
      totalUsed: 0,
      totalCost: 0,
      progressPercent: 0,
      lastEntry: null,
      lastEntryDate: null,
      unitPrice: 100,
      materialUnitPrice: 40,
      priceItemId: 7,
      materialItemId: 8,
      projectId: 99,
    });
    expect(prisma.project.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: 'Смета A (копия)',
        objectId: 15,
        catalogId: 4,
        note: 'старая заметка',
      }),
    });
    expect(result.copyStats).toEqual({
      sourceProjectId: 29,
      materials: 1,
      factsCopied: false,
    });
  });

  it('copyFacts переносит расход, прогресс и последнюю фиксацию', async () => {
    await service.copyProject(29, { copyFacts: true }, 7);

    const rows = prisma.material.createMany.mock.calls[0][0].data;
    expect(rows[0]).toMatchObject({
      totalUsed: 5,
      progressPercent: 50,
      totalCost: 500,
      materialTotalCost: 200,
      lastEntry: 2,
      lastEntryDate: new Date('2026-11-10'),
    });
  });

  it('название по умолчанию — «X (копия)», заметку можно стереть', async () => {
    await service.copyProject(29, { note: '' }, 7);

    expect(prisma.project.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ name: 'Смета A (копия)', note: null }),
    });
  });

  it('наблюдатель копию создать не может ⇒ Forbidden', async () => {
    prisma.objectAccess.findMany.mockResolvedValue([
      grant({ projectId: 29, role: 'VIEWER' }),
    ]);

    await expect(service.copyProject(29, {}, 7)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(prisma.project.create).not.toHaveBeenCalled();
  });

  it('скрытые цены ⇒ копия запрещена (иначе деньги открылись бы молча)', async () => {
    prisma.objectAccess.findMany.mockResolvedValue([
      grant({ projectId: 29, hidePrices: true }),
    ]);

    await expect(service.copyProject(29, {}, 7)).rejects.toThrow(
      /Цены проекта скрыты/,
    );
  });

  it('прораб без права создавать проекты ⇒ Forbidden', async () => {
    prisma.objectAccess.findFirst.mockResolvedValue(
      grant({ role: 'FOREMAN', canCreateProjects: false }),
    );

    await expect(service.copyProject(29, {}, 7)).rejects.toThrow(
      /Создавать проекты может администратор объекта/,
    );
    expect(prisma.project.create).not.toHaveBeenCalled();
  });

  it('дата окончания раньше начала ⇒ BadRequest', async () => {
    await expect(
      service.copyProject(29, { startDate: '2026-12-10', endDate: '2026-12-01' }, 7),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
// ⭐ №306: счётчик у кнопки «Участники проекта · N»
describe('ProjectsService — счётчик команды проекта (№306)', () => {
  const prisma = {
    project: { findMany: jest.fn(), findUnique: jest.fn() },
    projectHidden: { findMany: jest.fn() },
    objectAccess: { findMany: jest.fn() },
  };
  const audit = { log: jest.fn() };
  let service: ProjectsService;

  const project = (id: number) => ({
    id,
    name: `Проект ${id}`,
    objectId: 15,
    materials: [],
    catalog: null,
    object: { catalogId: null, catalog: null },
  });

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.projectHidden.findMany.mockResolvedValue([]);
    prisma.project.findMany.mockResolvedValue([project(29), project(30)]);
    service = new ProjectsService(prisma as never, audit as never);
  });

  it('администратор объекта видит, сколько людей открыто в проект', async () => {
    // 1-й вызов — доступы САМОГО пользователя, 2-й — команда объекта
    prisma.objectAccess.findMany
      .mockResolvedValueOnce([grant({ role: 'CUSTOMER' })])
      .mockResolvedValueOnce([
        { userId: 1, projectId: null }, // админ — видит все проекты
        { userId: 2, projectId: 29 },
        { userId: 3, projectId: 29 },
        { userId: 2, projectId: 30 },
      ]);

    const rows = await service.findAllByObject(15, 1);

    expect(rows.find((p) => p.id === 29)?.participantsCount).toBe(3);
    expect(rows.find((p) => p.id === 30)?.participantsCount).toBe(2);
  });

  it('точечный участник счётчик не получает и лишний запрос не делается', async () => {
    prisma.objectAccess.findMany.mockResolvedValue([grant({ projectId: 29 })]);

    const rows = await service.findAllByObject(15, 7);

    expect(rows.every((p) => p.participantsCount === null)).toBe(true);
    expect(prisma.objectAccess.findMany).toHaveBeenCalledTimes(1);
  });
});

