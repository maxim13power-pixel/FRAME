// backend/src/price-list/project-catalog.spec.ts
// ⭐ №321: «сколько единиц в упаковке» задаётся из сметы (калькулятор «от объёма»).
// Проверяем, что упаковка сохраняется при создании расценки и не теряется при копировании.
import { PriceItem } from '@prisma/client';
import { resolveProjectPriceItem } from './project-catalog';

const catalog = { id: 9, name: 'Мой справочник', ownerId: 5 };

const makeTx = () => ({
  project: {
    findUnique: jest.fn().mockResolvedValue({ id: 1, catalogId: 9, catalog }),
    update: jest.fn(),
  },
  priceCategory: {
    findFirst: jest.fn().mockResolvedValue(null),
    findUnique: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue({ id: 3 }),
  },
  priceItem: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn().mockResolvedValue([]),
    create: jest.fn(),
    update: jest.fn(),
  },
});

/** Типизированный доступ к аргументам замоканного вызова (без `any`-цепочек). */
const callArg = <T>(mock: jest.Mock, callIndex = 0): T => {
  const calls = mock.mock.calls as unknown[][];
  return calls[callIndex][0] as T;
};

const priceItemFactory =
  (id: number) => (args: { data: Record<string, unknown> }) => ({
    id,
    ...args.data,
  });

describe('resolveProjectPriceItem — упаковка материала (№321)', () => {
  it('новая расценка создаётся с упаковкой из калькулятора', async () => {
    const tx = makeTx();
    tx.priceItem.create.mockImplementation(priceItemFactory(77));

    const result = await resolveProjectPriceItem(tx as never, {
      projectId: 1,
      userId: 5,
      name: 'Цемент М500',
      unit: 'KILOGRAM',
      price: 500,
      kind: 'MATERIAL',
      packSize: 25,
    });

    expect(tx.priceItem.create).toHaveBeenCalledTimes(1);
    const data = callArg<{ data: Record<string, unknown> }>(
      tx.priceItem.create,
    ).data;
    expect(data).toMatchObject({ packSize: 25, price: 500 });
    expect(result.item.packSize).toBe(25);
  });

  it('без упаковки расценка создаётся как раньше — packSize = null', async () => {
    const tx = makeTx();
    tx.priceItem.create.mockImplementation(priceItemFactory(78));

    await resolveProjectPriceItem(tx as never, {
      projectId: 1,
      userId: 5,
      name: 'Шпаклёвка',
      unit: 'KILOGRAM',
      price: 700,
      kind: 'MATERIAL',
    });

    const data = callArg<{ data: Record<string, unknown> }>(
      tx.priceItem.create,
    ).data;
    expect(data).toMatchObject({ packSize: null });
  });

  it('копия чужой расценки сохраняет упаковку источника', async () => {
    const source = {
      id: 5,
      catalogId: 2,
      name: 'Краска фасадная',
      article: null,
      unit: 'LITER',
      price: 3200,
      packSize: 9,
      categoryId: 4,
      kind: 'MATERIAL',
      isActive: true,
    } as unknown as PriceItem;
    const tx = makeTx();
    tx.priceItem.findUnique.mockResolvedValue(source);
    tx.priceItem.create.mockImplementation(priceItemFactory(79));

    await resolveProjectPriceItem(tx as never, {
      projectId: 1,
      userId: 5,
      itemId: 5,
      name: source.name,
      unit: source.unit,
      price: Number(source.price),
      kind: 'MATERIAL',
    });

    const data = callArg<{ data: Record<string, unknown> }>(
      tx.priceItem.create,
    ).data;
    expect(data).toMatchObject({ packSize: 9 });
  });

  it('явная упаковка перекрывает значение источника', async () => {
    const source = {
      id: 6,
      catalogId: 2,
      name: 'Грунтовка',
      article: null,
      unit: 'LITER',
      price: 900,
      packSize: 10,
      categoryId: 4,
      kind: 'MATERIAL',
      isActive: true,
    } as unknown as PriceItem;
    const tx = makeTx();
    tx.priceItem.findUnique.mockResolvedValue(source);
    tx.priceItem.create.mockImplementation(priceItemFactory(80));

    await resolveProjectPriceItem(tx as never, {
      projectId: 1,
      userId: 5,
      itemId: 6,
      name: source.name,
      unit: source.unit,
      price: Number(source.price),
      kind: 'MATERIAL',
      packSize: 14,
    });

    const data = callArg<{ data: Record<string, unknown> }>(
      tx.priceItem.create,
    ).data;
    expect(data).toMatchObject({ packSize: 14 });
  });

  it('у существующей расценки обновляется только упаковка, если цена та же', async () => {
    const existing = {
      id: 12,
      catalogId: 9,
      name: 'Клей плиточный',
      article: null,
      unit: 'KILOGRAM',
      price: 420,
      packSize: null,
      categoryId: 3,
      kind: 'MATERIAL',
      isActive: true,
    } as unknown as PriceItem;
    const tx = makeTx();
    tx.priceItem.findMany.mockResolvedValue([existing]);
    tx.priceItem.update.mockResolvedValue({ ...existing, packSize: 25 });

    await resolveProjectPriceItem(tx as never, {
      projectId: 1,
      userId: 5,
      name: 'Клей плиточный',
      unit: 'KILOGRAM',
      price: 420,
      kind: 'MATERIAL',
      packSize: 25,
    });

    expect(tx.priceItem.update).toHaveBeenCalledWith({
      where: { id: 12 },
      data: { packSize: 25 },
    });
  });
});
