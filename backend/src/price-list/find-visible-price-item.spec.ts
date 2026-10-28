// backend/src/price-list/find-visible-price-item.spec.ts
// ⭐ №191 (F6): расценку можно взять только из справочника, который пользователь видит.
import { findVisiblePriceItem } from './catalog-access';

describe('findVisiblePriceItem (F6, №191)', () => {
  const prisma = {
    priceItem: { findUnique: jest.fn() },
    priceCatalog: { findUnique: jest.fn() },
    object: { findMany: jest.fn() },
    project: { findMany: jest.fn() },
    user: { findUnique: jest.fn() },
    objectAccess: { findMany: jest.fn() },
  };

  const item = {
    id: 500,
    catalogId: 10,
    price: 5400,
    isActive: true,
    name: 'Бетонирование колонн',
  };

  const catalog = (ownerId: number | null) => ({
    id: 10,
    name: 'Справочник',
    ownerId,
    isArchived: false,
  });

  const grant = (over: Record<string, unknown> = {}) => ({
    id: 1,
    objectId: 15,
    projectId: null as number | null,
    role: 'FOREMAN',
    hidePrices: false,
    isManager: false,
    isHidden: false,
    revokedAt: null as Date | null,
    ...over,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.priceItem.findUnique.mockResolvedValue(item);
    prisma.object.findMany.mockResolvedValue([]);
    prisma.project.findMany.mockResolvedValue([]);
    prisma.user.findUnique.mockResolvedValue({ role: 'FOREMAN' });
    prisma.objectAccess.findMany.mockResolvedValue([]);
  });

  it('системный справочник (ownerId=null) ⇒ расценка видна', async () => {
    prisma.priceCatalog.findUnique.mockResolvedValue(catalog(null));

    await expect(findVisiblePriceItem(prisma as any, 500, 7)).resolves.toEqual(
      item,
    );
  });

  it('свой личный справочник ⇒ видна', async () => {
    prisma.priceCatalog.findUnique.mockResolvedValue(catalog(7));

    await expect(findVisiblePriceItem(prisma as any, 500, 7)).resolves.toEqual(
      item,
    );
  });

  it('чужой личный справочник без привязок ⇒ null (утечки нет)', async () => {
    prisma.priceCatalog.findUnique.mockResolvedValue(catalog(8));

    await expect(
      findVisiblePriceItem(prisma as any, 500, 7),
    ).resolves.toBeNull();
  });

  it('справочник объекта, где я участник ⇒ видна', async () => {
    prisma.priceCatalog.findUnique.mockResolvedValue(catalog(8));
    prisma.object.findMany.mockResolvedValue([{ id: 15, name: 'Объект' }]);
    prisma.objectAccess.findMany.mockResolvedValue([grant()]);

    await expect(findVisiblePriceItem(prisma as any, 500, 7)).resolves.toEqual(
      item,
    );
  });

  it('справочник объекта, где доступ отозван ⇒ null', async () => {
    prisma.priceCatalog.findUnique.mockResolvedValue(catalog(8));
    prisma.object.findMany.mockResolvedValue([{ id: 15, name: 'Объект' }]);
    prisma.objectAccess.findMany.mockResolvedValue([
      grant({ revokedAt: new Date('2026-10-01') }),
    ]);

    await expect(
      findVisiblePriceItem(prisma as any, 500, 7),
    ).resolves.toBeNull();
  });

  it('расценки нет ⇒ null', async () => {
    prisma.priceItem.findUnique.mockResolvedValue(null);

    await expect(
      findVisiblePriceItem(prisma as any, 999, 7),
    ).resolves.toBeNull();
  });

  it('ADMIN видит любую расценку', async () => {
    prisma.priceCatalog.findUnique.mockResolvedValue(catalog(8));
    prisma.user.findUnique.mockResolvedValue({ role: 'ADMIN' });

    await expect(findVisiblePriceItem(prisma as any, 500, 1)).resolves.toEqual(
      item,
    );
  });
});
