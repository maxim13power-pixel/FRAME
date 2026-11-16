// backend/src/price-list/working-catalog.spec.ts
import { Prisma } from '@prisma/client';
import { ensureProjectCatalog, ensureWorkingCatalog, WORKING_CATALOG_NAME } from './working-catalog';

type Db = Prisma.TransactionClient;

const asDb = (value: unknown): Db => value as Db;

describe('ensureWorkingCatalog — одна рабочая база (§117)', () => {
  it('возвращает справочник с isDefault и ничего не создаёт', async () => {
    const db = {
      priceCatalog: {
        findFirst: jest.fn().mockResolvedValue({ id: 5, name: 'Моя база', ownerId: 7 }),
        update: jest.fn(),
        create: jest.fn(),
      },
    };
    const result = await ensureWorkingCatalog(asDb(db), 7);
    expect(result).toEqual({ id: 5, name: 'Моя база', ownerId: 7 });
    expect(db.priceCatalog.create).not.toHaveBeenCalled();
    expect(db.priceCatalog.update).not.toHaveBeenCalled();
  });

  it('если isDefault нет — берёт самую наполненную свою и помечает её', async () => {
    const db = {
      priceCatalog: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({ id: 9, name: 'Копия демо', ownerId: 7 }),
        update: jest.fn().mockResolvedValue({ id: 9, name: 'Копия демо', ownerId: 7 }),
        create: jest.fn(),
      },
    };
    const result = await ensureWorkingCatalog(asDb(db), 7);
    expect(result.id).toBe(9);
    expect(db.priceCatalog.update).toHaveBeenCalledWith({
      where: { id: 9 },
      data: { isDefault: true },
    });
    expect(db.priceCatalog.create).not.toHaveBeenCalled();
  });

  it('если справочников нет — создаёт пустой «Мой справочник»', async () => {
    const db = {
      priceCatalog: {
        findFirst: jest.fn().mockResolvedValue(null),
        update: jest.fn(),
        create: jest
          .fn()
          .mockResolvedValue({ id: 11, name: WORKING_CATALOG_NAME, ownerId: 7 }),
      },
    };
    const result = await ensureWorkingCatalog(asDb(db), 7);
    expect(result.id).toBe(11);
    expect(db.priceCatalog.create).toHaveBeenCalledWith({
      data: { name: WORKING_CATALOG_NAME, ownerId: 7, kind: 'USER', isDefault: true },
      select: { id: true, name: true, ownerId: true },
    });
  });
});

describe('ensureProjectCatalog — проект ссылается на базу (§117)', () => {
  it('не трогает проект, если справочник уже привязан', async () => {
    const db = {
      project: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: 3, catalogId: 5, catalog: { id: 5, name: 'Моя', ownerId: 7 } }),
        update: jest.fn(),
      },
      priceCatalog: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
    };
    const result = await ensureProjectCatalog(asDb(db), 3, 7);
    expect(result.id).toBe(5);
    expect(db.project.update).not.toHaveBeenCalled();
    expect(db.priceCatalog.create).not.toHaveBeenCalled();
  });

  it('проекту без базы привязывает рабочую БЕЗ создания «Справочника проекта»', async () => {
    const db = {
      project: {
        findUnique: jest.fn().mockResolvedValue({ id: 3, catalogId: null, catalog: null }),
        update: jest.fn().mockResolvedValue({}),
      },
      priceCatalog: {
        findFirst: jest.fn().mockResolvedValue({ id: 5, name: 'Моя база', ownerId: 7 }),
        update: jest.fn(),
        create: jest.fn(),
      },
    };
    const result = await ensureProjectCatalog(asDb(db), 3, 7);
    expect(result.id).toBe(5);
    expect(db.project.update).toHaveBeenCalledWith({
      where: { id: 3 },
      data: { catalogId: 5 },
    });
    expect(db.priceCatalog.create).not.toHaveBeenCalled();
  });
});
