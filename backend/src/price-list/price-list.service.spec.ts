// backend/src/price-list/price-list.service.spec.ts
// ⭐ №159: поиск расценок в справочнике проекта — доступ к справочнику и снятие owner-фильтра.
import { NotFoundException } from '@nestjs/common';
import { PriceListService } from './price-list.service';

describe('PriceListService — поиск в справочнике проекта (№159)', () => {
  const prisma = {
    priceItem: { findMany: jest.fn() },
    priceCatalog: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    project: { findFirst: jest.fn() },
  };

  const audit = { log: jest.fn() };
  let service: PriceListService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.priceItem.findMany.mockResolvedValue([]);
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
