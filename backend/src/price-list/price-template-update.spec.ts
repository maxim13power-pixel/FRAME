// backend/src/price-list/price-template-update.spec.ts
import { PriceKind } from '@prisma/client';
import { PriceTemplateUpdateService } from './price-template-update.service';

const catalog = {
  id: 10,
  name: 'Моя база',
  ownerId: 7,
  templateId: 1,
  templateVersion: 0,
};
const template = { id: 1, name: 'Демо-справочник', templateVersion: 2 };

/** Позиции личной базы: одна с другой ценой, одна убранная пользователем */
const targetItems = [
  { id: 100, name: 'Укладка ламината', unit: 'SQUARE_METER', kind: 'WORK', price: 400, isActive: true },
  { id: 101, name: 'Убранная позиция', unit: 'PIECE', kind: 'WORK', price: 10, isActive: false },
];
/** Образец: новая позиция + изменившаяся цена + та, что пользователь убрал */
const templateItems = [
  { id: 1, name: 'Укладка ламината', unit: 'SQUARE_METER', kind: 'WORK', price: 550, categoryId: 5 },
  { id: 2, name: 'Убранная позиция', unit: 'PIECE', kind: 'WORK', price: 10, categoryId: 5 },
  { id: 3, name: 'Новая расценка', unit: 'PIECE', kind: 'WORK', price: 900, categoryId: 5 },
];

const buildService = () => {
  const prisma = {
    priceCatalog: {
      findUnique: jest.fn().mockResolvedValueOnce(catalog).mockResolvedValueOnce(template),
      update: jest.fn().mockResolvedValue({}),
    },
    priceItem: {
      findMany: jest
        .fn()
        .mockResolvedValueOnce(targetItems)
        .mockResolvedValueOnce(templateItems),
      createMany: jest.fn().mockResolvedValue({ count: 1 }),
      update: jest.fn().mockResolvedValue({}),
    },
    $transaction: jest.fn(async (fn: (tx: unknown) => unknown) => fn(prisma)),
  };
  const prices = { assertCanEditCatalog: jest.fn().mockResolvedValue({}) };
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  const service = new PriceTemplateUpdateService(
    prisma as never,
    prices as never,
    audit as never,
  );
  return { service, prisma, audit };
};

describe('PriceTemplateUpdateService — обновление из образца (§122)', () => {
  it('превью: новая позиция и изменение цены, убранные не возвращаются', async () => {
    const { service } = buildService();
    const preview = await service.preview(10, 7);

    expect(preview.available).toBe(true);
    expect(preview.stats).toEqual({ add: 1, price: 1 });
    const actions = preview.rows.map((row) => `${row.action}:${row.name}`).sort();
    expect(actions).toEqual(['add:Новая расценка', 'price:Укладка ламината']);
    expect(preview.rows.find((row) => row.action === 'price')).toMatchObject({
      oldPrice: 400,
      newPrice: 550,
      itemId: 100,
    });
  });

  it('применение «только новые»: создаёт позицию, цены не трогает, версия обновлена', async () => {
    const { service, prisma } = buildService();
    const result = await service.apply(10, 7, 'missing');

    expect(result).toMatchObject({ added: 1, updatedPrices: 0 });
    expect(prisma.priceItem.createMany).toHaveBeenCalledTimes(1);
    expect(prisma.priceItem.update).not.toHaveBeenCalled();
    expect(prisma.priceCatalog.update).toHaveBeenCalledWith({
      where: { id: 10 },
      data: { templateVersion: 2 },
    });
  });

  it('применение «всё»: добавляет позицию и обновляет цену совпавшей', async () => {
    const { service, prisma } = buildService();
    const result = await service.apply(10, 7, 'all');

    expect(result).toMatchObject({ added: 1, updatedPrices: 1 });
    expect(prisma.priceItem.update).toHaveBeenCalledWith({
      where: { id: 100 },
      data: { price: 550 },
    });
  });

  it('справочник не из образца — понятная ошибка', async () => {
    const { service, prisma } = buildService();
    prisma.priceCatalog.findUnique.mockReset();
    prisma.priceCatalog.findUnique.mockResolvedValueOnce({ ...catalog, templateId: null });

    await expect(service.preview(10, 7)).rejects.toThrow(/не из образца/i);
  });
});
