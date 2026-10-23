// backend/src/materials/materials.service.spec.ts
// ⭐ №159: новая расценка из сметы пишется в справочник проекта, а не в первый личный.
import { BadRequestException } from '@nestjs/common';
import { MaterialsService } from './materials.service';

describe('MaterialsService — справочник новой расценки (№159)', () => {
  const prisma = {
    objectAccess: { findMany: jest.fn() },
    priceCategory: { findUnique: jest.fn() },
    priceCatalog: { findFirst: jest.fn(), create: jest.fn() },
    priceItem: { create: jest.fn() },
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
    service = new MaterialsService(prisma as any, audit as any);
  });

  it('catalogId проекта: расценка пишется в него, личный справочник не ищется', async () => {
    prisma.priceCatalog.findFirst.mockResolvedValue({
      id: 8,
      ownerId: 7,
      isArchived: false,
    });

    await service.createPriceItemWithCategory(
      dto as any,
      undefined,
      'WORK',
      7,
      8,
    );

    expect(prisma.priceCatalog.findFirst).toHaveBeenCalledTimes(1);
    expect(prisma.priceCatalog.findFirst).toHaveBeenCalledWith({
      where: { id: 8, OR: [{ ownerId: null }, { ownerId: 7 }] },
    });
    expect(prisma.priceItem.create.mock.calls[0][0].data).toMatchObject({
      name: 'Штукатурка стен',
      categoryId: 4,
      catalogId: 8,
      ownerId: 7,
    });
  });

  it('архивный справочник ⇒ BadRequestException, расценка не создаётся', async () => {
    prisma.priceCatalog.findFirst.mockResolvedValue({
      id: 8,
      ownerId: 7,
      isArchived: true,
    });

    await expect(
      service.createPriceItemWithCategory(dto as any, undefined, 'WORK', 7, 8),
    ).rejects.toThrow(BadRequestException);
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
