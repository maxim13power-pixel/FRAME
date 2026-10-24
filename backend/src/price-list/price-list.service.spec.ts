// backend/src/price-list/price-list.service.spec.ts
// ⭐ №159: поиск расценок в справочнике проекта — доступ к справочнику и снятие owner-фильтра.
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PriceListService } from './price-list.service';

describe('PriceListService — поиск в справочнике проекта (№159)', () => {
  const prisma = {
    priceItem: { findMany: jest.fn() },
    priceCatalog: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    object: { findFirst: jest.fn() },
    project: { findFirst: jest.fn() },
  };

  const audit = { log: jest.fn() };
  let service: PriceListService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.priceItem.findMany.mockResolvedValue([]);
    prisma.object.findFirst.mockResolvedValue(null);
    service = new PriceListService(prisma as any, audit as any);
  });

  it('без catalogId — прежний фильтр «общие + личные»', async () => {
    await service.searchItems(undefined, undefined, 'WORK', 7);

    const where = prisma.priceItem.findMany.mock.calls[0][0].where;
    expect(where.AND).toContainEqual({ OR: [{ ownerId: null }, { ownerId: 7 }] });
    expect(where.AND.some((c: any) => 'catalogId' in c)).toBe(false);
  });

  it('свой справочник: фильтр по catalogId есть, owner-фильтра нет', async () => {
    prisma.priceCatalog.findUnique.mockResolvedValue({ ownerId: 7 });

    await service.searchItems(undefined, undefined, 'WORK', 7, 5);

    const where = prisma.priceItem.findMany.mock.calls[0][0].where;
    expect(where.AND).toContainEqual({ catalogId: 5 });
    expect(where.AND.some((c: any) => 'OR' in c)).toBe(false);
    expect(prisma.project.findFirst).not.toHaveBeenCalled();
  });

  it('системный справочник доступен всем участникам', async () => {
    prisma.priceCatalog.findUnique.mockResolvedValue({ ownerId: null });

    await expect(
      service.searchItems(undefined, undefined, 'WORK', 7, 1),
    ).resolves.toEqual([]);
    expect(prisma.project.findFirst).not.toHaveBeenCalled();
  });

  it('чужой личный справочник, привязанный к проекту пользователя, доступен', async () => {
    prisma.priceCatalog.findUnique.mockResolvedValue({ ownerId: 99 });
    prisma.project.findFirst.mockResolvedValue({ id: 3 });

    await expect(
      service.searchItems(undefined, undefined, 'WORK', 7, 5),
    ).resolves.toEqual([]);
    expect(prisma.project.findFirst).toHaveBeenCalledWith({
      where: { catalogId: 5, object: { accesses: { some: { userId: 7 } } } },
      select: { id: true },
    });
  });

  it('чужой личный справочник без привязки к проекту ⇒ NotFoundException', async () => {
    prisma.priceCatalog.findUnique.mockResolvedValue({ ownerId: 99 });
    prisma.project.findFirst.mockResolvedValue(null);

    await expect(
      service.searchItems(undefined, undefined, 'WORK', 7, 5),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.priceItem.findMany).not.toHaveBeenCalled();
  });
});

// ⭐ №164: объектный и проектный справочники; «поделиться» = копирование расценок.
describe('PriceListService — справочники объекта и проекта (№164)', () => {
  const prisma = {
    priceItem: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      createMany: jest.fn(),
      update: jest.fn(),
    },
    priceCatalog: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    priceCategory: { findMany: jest.fn() },
    objectAccess: { findMany: jest.fn() },
    object: { findUnique: jest.fn(), findMany: jest.fn(), update: jest.fn() },
    project: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    user: { findUnique: jest.fn() },
  };

  const audit = { log: jest.fn() };
  let service: PriceListService;

  /** Справочник объекта 10, владелец — другой пользователь (99) */
  const objectCatalog = {
    id: 5,
    name: 'Справочник объекта',
    ownerId: 99,
    isArchived: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.object.findMany.mockResolvedValue([{ id: 10, name: 'Объект' }]);
    prisma.project.findMany.mockResolvedValue([]);
    prisma.objectAccess.findMany.mockResolvedValue([
      { objectId: 10, projectId: null, role: 'FOREMAN', hidePrices: false },
    ]);
    prisma.user.findUnique.mockResolvedValue({ role: 'FOREMAN' });
    service = new PriceListService(prisma as any, audit as any);
  });
  it('listCatalogs: объектный справочник виден участнику с canWrite', async () => {
    prisma.priceCatalog.findMany.mockResolvedValue([
      {
        id: 5,
        name: 'Справочник объекта',
        ownerId: 99,
        createdAt: new Date('2026-10-20T10:00:00Z'),
        _count: { items: 3, projects: 0, objects: 1 },
        objects: [{ id: 10, name: 'Объект' }],
        projects: [],
      },
    ]);

    const [catalog] = await service.listCatalogs(7);

    expect(catalog.scope).toBe('object');
    expect(catalog.objectId).toBe(10);
    expect(catalog.canWrite).toBe(true);
    expect(catalog.itemsCount).toBe(3);
    expect(prisma.objectAccess.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 7 } }),
    );
  });

  it('listCatalogs: наблюдатель видит объектный справочник, но не может писать', async () => {
    prisma.priceCatalog.findMany.mockResolvedValue([
      {
        id: 5,
        name: 'Справочник объекта',
        ownerId: 99,
        createdAt: new Date(),
        _count: { items: 3, projects: 0, objects: 1 },
        objects: [{ id: 10, name: 'Объект' }],
        projects: [],
      },
    ]);
    prisma.objectAccess.findMany.mockResolvedValue([
      { objectId: 10, projectId: null, role: 'VIEWER', hidePrices: true },
    ]);

    const [catalog] = await service.listCatalogs(7);

    expect(catalog.canWrite).toBe(false);
  });

  it('getCategoriesWithItems: чужой справочник без доступа ⇒ NotFoundException', async () => {
    prisma.priceCatalog.findUnique.mockResolvedValue(objectCatalog);
    prisma.objectAccess.findMany.mockResolvedValue([]);

    await expect(service.getCategoriesWithItems('WORK', 7, 5)).rejects.toThrow(
      NotFoundException,
    );
    expect(prisma.priceCategory.findMany).not.toHaveBeenCalled();
  });

  it('updateItem: прораб объекта меняет расценку объектного справочника', async () => {
    prisma.priceItem.findUnique.mockResolvedValue({
      id: 1,
      catalogId: 5,
      name: 'Штукатурка',
      unit: 'PIECE',
      price: 100,
    });
    prisma.priceCatalog.findUnique.mockResolvedValue(objectCatalog);
    prisma.priceItem.update.mockResolvedValue({
      id: 1,
      catalogId: 5,
      name: 'Штукатурка',
      unit: 'PIECE',
      price: 120,
    });

    const updated = await service.updateItem(1, { price: 120 }, 7);

    expect(updated.price).toBe(120);
    expect(prisma.priceItem.update).toHaveBeenCalled();
  });

  it('updateItem: наблюдатель получает 403', async () => {
    prisma.priceItem.findUnique.mockResolvedValue({ id: 1, catalogId: 5 });
    prisma.priceCatalog.findUnique.mockResolvedValue(objectCatalog);
    prisma.objectAccess.findMany.mockResolvedValue([
      { objectId: 10, projectId: null, role: 'VIEWER', hidePrices: false },
    ]);

    await expect(service.updateItem(1, { price: 120 }, 7)).rejects.toThrow(
      ForbiddenException,
    );
    expect(prisma.priceItem.update).not.toHaveBeenCalled();
  });
  it('updateItem: системный справочник правит только ADMIN, даже если привязан к проекту', async () => {
    prisma.priceItem.findUnique.mockResolvedValue({ id: 1, catalogId: 1 });
    prisma.priceCatalog.findUnique.mockResolvedValue({
      id: 1,
      name: 'Демо-справочник',
      ownerId: null,
      isArchived: false,
    });
    prisma.object.findMany.mockResolvedValue([]);
    prisma.project.findMany.mockResolvedValue([
      { id: 29, name: 'Монолит', objectId: 15 },
    ]);
    prisma.objectAccess.findMany.mockResolvedValue([
      { objectId: 15, projectId: 29, role: 'FOREMAN', hidePrices: false },
    ]);

    await expect(service.updateItem(1, { price: 120 }, 7)).rejects.toThrow(
      ForbiddenException,
    );
    expect(prisma.priceItem.update).not.toHaveBeenCalled();
  });

  it('createCatalog с objectId: наблюдатель не может завести справочник объекта', async () => {
    prisma.object.findUnique.mockResolvedValue({ id: 10 });
    prisma.objectAccess.findMany.mockResolvedValue([
      { objectId: 10, projectId: null, role: 'VIEWER', hidePrices: false },
    ]);

    await expect(
      service.createCatalog('Справочник', 7, { objectId: 10 }),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.priceCatalog.create).not.toHaveBeenCalled();
  });

  it('copyCatalog: копирует активные расценки в новый справочник объекта', async () => {
    prisma.priceCatalog.findUnique.mockResolvedValue({
      id: 5,
      name: 'Исходный',
      ownerId: 7,
      isArchived: false,
    });
    prisma.priceItem.findMany.mockResolvedValue([
      {
        name: 'Штукатурка',
        article: 'ST-1',
        unit: 'PIECE',
        price: 100,
        categoryId: 3,
        kind: 'WORK',
      },
    ]);
    prisma.object.findUnique.mockResolvedValue({ id: 10 });
    prisma.priceCatalog.findFirst.mockResolvedValue(null);
    prisma.priceCatalog.create.mockResolvedValue({
      id: 77,
      name: 'Копия «Исходный»',
      ownerId: 7,
    });

    const created = await service.copyCatalog(5, 7, { objectId: 10 });

    expect(created.id).toBe(77);
    expect(created.itemsCount).toBe(1);
    expect(prisma.object.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 10 },
        data: { catalogId: 77 },
      }),
    );
    const data = prisma.priceItem.createMany.mock.calls[0][0].data;
    expect(data).toHaveLength(1);
    expect(data[0]).toMatchObject({
      catalogId: 77,
      ownerId: 7,
      name: 'Штукатурка',
    });
    expect(audit.log).toHaveBeenCalledWith(
      7,
      'price_catalog',
      77,
      'copy',
      expect.objectContaining({ sourceCatalogId: 5, items: 1 }),
    );
  });




});
