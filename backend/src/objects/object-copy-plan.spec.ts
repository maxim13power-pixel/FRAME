// backend/src/objects/object-copy-plan.spec.ts
import { Unit } from '@prisma/client';
import { buildObjectCopyPlan, CopyPriceRow } from './object-copy-plan';

const row = (patch: Partial<CopyPriceRow> = {}): CopyPriceRow => ({
  id: 1,
  name: 'Штукатурка стен',
  article: 'W-1',
  unit: Unit.SQUARE_METER,
  specQuantity: 10,
  totalUsed: 0,
  priceItemId: 100,
  unitPrice: 500,
  materialItemId: null,
  materialUnitPrice: 0,
  ...patch,
});

const ref = (patch: Record<string, unknown> = {}) => ({
  id: 100,
  name: 'Штукатурка стен',
  article: 'W-1',
  unit: Unit.SQUARE_METER,
  price: 500,
  ...patch,
}) as any;

describe('buildObjectCopyPlan — цены для копии объекта', () => {
  it('точная карта старый ID → новый ID переносит ссылку, даже если цена та же', () => {
    const plan = buildObjectCopyPlan(
      [row()],
      [ref({ id: 900, price: 500 })],
      [],
      new Map([[100, 900]]),
    );

    expect(plan.summary.unmatchedRows).toBe(0);
    expect(plan.summary.priceChanges).toBe(1);
    expect(plan.rows[0].work.itemId).toBe(900);
    expect(plan.rows[0].work.changed).toBe(true);
  });

  it('пересчитывает строки с фактическим расходом (решение владельца)', () => {
    const plan = buildObjectCopyPlan(
      [row({ totalUsed: 5 })],
      [ref({ id: 900, price: 650 })],
      [],
      new Map([[100, 900]]),
    );

    expect(plan.rows[0].hasFacts).toBe(true);
    expect(plan.rows[0].apply).toBe(true);
    expect(plan.rows[0].work.newPrice).toBe(650);
  });

  it('находит расценку по артикулу, если ID в целевом справочнике другой', () => {
    const plan = buildObjectCopyPlan(
      [row({ priceItemId: 1 })],
      [ref({ id: 55, article: 'W-1' })],
      [],
    );

    expect(plan.rows[0].work.match).toBe('article');
    expect(plan.rows[0].work.itemId).toBe(55);
  });

  it('неоднозначное название — ошибка соответствия, цену не подставляет', () => {
    const plan = buildObjectCopyPlan(
      [row({ priceItemId: null })],
      [
        ref({ id: 1, article: null }),
        ref({ id: 2, article: null, price: 700 }),
      ],
      [],
    );

    expect(plan.rows[0].work.match).toBe('ambiguous');
    expect(plan.rows[0].work.issue).toBe(true);
    expect(plan.rows[0].work.newPrice).toBe(500);
    expect(plan.summary.unmatchedRows).toBe(1);
  });

  it('пустая строка без цены и ссылки не считается ошибкой', () => {
    const plan = buildObjectCopyPlan(
      [
        row({
          name: 'Без цены',
          article: null,
          priceItemId: null,
          unitPrice: 0,
        }),
      ],
      [],
      [],
    );

    expect(plan.rows[0].work.issue).toBe(false);
    expect(plan.summary.unmatchedRows).toBe(0);
  });

  it('если название строки не совпало, материал ищется по исходной расценке', () => {
    const plan = buildObjectCopyPlan(
      [row({ priceItemId: null, materialItemId: 7, materialUnitPrice: 50 })],
      [],
      [ref({ id: 77, name: 'Материал по прайсу', article: 'M-7', price: 60 })],
      undefined,
      new Map([
        [
          7,
          {
            id: 7,
            name: 'Материал по прайсу',
            article: 'M-7',
            unit: Unit.PIECE,
            price: 50,
          },
        ],
      ]),
    );

    expect(plan.rows[0].material.match).toBe('article');
    expect(plan.rows[0].material.itemId).toBe(77);
    expect(plan.rows[0].material.issue).toBe(false);
  });

  it('работы и материалы ищутся раздельно', () => {
    const plan = buildObjectCopyPlan(
      [
        row({
          priceItemId: 1,
          materialItemId: 2,
          materialUnitPrice: 100,
        }),
      ],
      [ref({ id: 11, price: 600 })],
      [ref({ id: 22, price: 120, name: 'Штукатурка стен' })],
    );

    expect(plan.rows[0].work.itemId).toBe(11);
    expect(plan.rows[0].material.itemId).toBe(22);
    expect(plan.rows[0].work.newPrice).toBe(600);
    expect(plan.rows[0].material.newPrice).toBe(120);
  });
});
