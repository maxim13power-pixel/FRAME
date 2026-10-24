// backend/src/materials/materials.service.spec.ts
// ⭐ №159: новая расценка из сметы пишется в справочник проекта, а не в первый личный.
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { MaterialsService } from './materials.service';

describe('MaterialsService — справочник новой расценки (№159)', () => {
  const prisma = {
    objectAccess: { findMany: jest.fn() },
    priceCategory: { findUnique: jest.fn() },
    priceCatalog: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    priceItem: { create: jest.fn() },
    object: { findMany: jest.fn() },
    project: { findMany: jest.fn() },
    user: { findUnique: jest.fn() },
  };
  const audit = { log: jest.fn() };
  let service: MaterialsService;

  const dto = {
    name: '  Штукатурка стен  ',
    unit: 'SQUARE_METER',
    price: 300,
    categoryId: 4,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.objectAccess.findMany.mockResolvedValue([]);
    prisma.priceCategory.findUnique.mockResolvedValue({
      id: 4,
      name: 'Отделка',
      kind: 'WORK',
    });
    prisma.priceItem.create.mockResolvedValue({ id: 100 });
    // ⭐ №164: доступ к справочнику считается через loadCatalogAccess
    prisma.priceCatalog.findUnique.mockResolvedValue({
      id: 8,
      name: 'Справочник проекта',
      ownerId: 7,
      isArchived: false,
    });
    prisma.object.findMany.mockResolvedValue([]);
    prisma.project.findMany.mockResolvedValue([]);
    prisma.user.findUnique.mockResolvedValue({ role: 'FOREMAN' });
    service = new MaterialsService(prisma as any, audit as any);
  });

  it('catalogId проекта: расценка пишется в него, личный справочник не ищется', async () => {
    await service.createPriceItemWithCategory(
      dto as any,
      undefined,
      'WORK',
      7,
      8,
    );

    expect(prisma.priceCatalog.findUnique).toHaveBeenCalledWith({
      where: { id: 8 },
      select: { id: true, name: true, ownerId: true, isArchived: true },
    });
    expect(prisma.priceCatalog.findFirst).not.toHaveBeenCalled();
    expect(prisma.priceItem.create.mock.calls[0][0].data).toMatchObject({
      name: 'Штукатурка стен',
      categoryId: 4,
      catalogId: 8,
      ownerId: 7,
    });
  });

  it('архивный справочник ⇒ BadRequestException, расценка не создаётся', async () => {
    prisma.priceCatalog.findUnique.mockResolvedValue({
      id: 8,
      name: 'Справочник проекта',
      ownerId: 7,
      isArchived: true,
    });

    await expect(
      service.createPriceItemWithCategory(dto as any, undefined, 'WORK', 7, 8),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.priceItem.create).not.toHaveBeenCalled();
  });

  it('чужой справочник без доступа ⇒ NotFoundException', async () => {
    prisma.priceCatalog.findUnique.mockResolvedValue({
      id: 8,
      name: 'Чужой справочник',
      ownerId: 99,
      isArchived: false,
    });

    await expect(
      service.createPriceItemWithCategory(dto as any, undefined, 'WORK', 7, 8),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.priceItem.create).not.toHaveBeenCalled();
  });

  it('без catalogId — прежнее поведение: первый личный справочник', async () => {
    prisma.priceCatalog.findFirst.mockResolvedValue({
      id: 3,
      ownerId: 7,
      isArchived: false,
    });

    await service.createPriceItemWithCategory(
      dto as any,
      undefined,
      'WORK',
      7,
    );

    expect(prisma.priceCatalog.findFirst).toHaveBeenCalledWith({
      where: { ownerId: 7 },
      orderBy: { id: 'asc' },
    });
    expect(prisma.priceItem.create.mock.calls[0][0].data).toMatchObject({
      catalogId: 3,
    });
  });
});

// ⭐ №162: копирование строки материала — план копируется, факт и фиксации нет
describe('MaterialsService — копирование строки (№162)', () => {
  const source = {
    id: 10,
    name: 'Стяжка пола',
    article: 'ST-10',
    unit: 'SQUARE_METER',
    specQuantity: 68,
    totalUsed: 20,
    note: 'черновая',
    projectId: 3,
    priceItemId: 5,
    unitPrice: 450,
    totalCost: 9000,
    materialItemId: null,
    materialUnitPrice: 0,
    materialTotalCost: 0,
    isSpecLocked: true,
  };
  const prisma = {
    objectAccess: { findFirst: jest.fn() },
    material: { findUnique: jest.fn(), create: jest.fn() },
  };
  const audit = { log: jest.fn() };
  let service: MaterialsService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.objectAccess.findFirst.mockResolvedValue({
      role: 'CUSTOMER',
      hidePrices: false,
    });
    prisma.material.findUnique.mockResolvedValue({
      ...source,
      project: { objectId: 1 },
    });
    prisma.material.create.mockImplementation(({ data }) => ({ id: 11, ...data }));
    service = new MaterialsService(prisma as any, audit as any);
  });

  it('копирует план, но не факт: totalUsed/totalCost = 0', async () => {
    const copy = await service.duplicate(10, 7);

    const data = prisma.material.create.mock.calls[0][0].data;
    expect(data).toMatchObject({
      name: 'Стяжка пола (копия)',
      specQuantity: 68,
      totalUsed: 0,
      totalCost: 0,
      priceItemId: 5,
      unitPrice: 450,
      projectId: 3,
    });
    expect(copy.id).toBe(11);
    expect(audit.log).toHaveBeenCalledWith(
      7,
      'material',
      11,
      'create',
      undefined,
      { name: 'Стяжка пола (копия)', copiedFrom: 10 },
    );
  });

  it('именует копии по счётчику: «(копия)» → «(копия 2)»', async () => {
    prisma.material.findUnique.mockResolvedValue({
      ...source,
      name: 'Стяжка пола (копия)',
      project: { objectId: 1 },
    });

    await service.duplicate(10, 7);

    expect(prisma.material.create.mock.calls[0][0].data.name).toBe(
      'Стяжка пола (копия 2)',
    );
  });

  it('VIEWER не может копировать (403)', async () => {
    prisma.objectAccess.findFirst.mockResolvedValue({
      role: 'VIEWER',
      hidePrices: true,
    });

    await expect(service.duplicate(10, 7)).rejects.toThrow(ForbiddenException);
    expect(prisma.material.create).not.toHaveBeenCalled();
  });
});
