// backend/src/estimate-recalc/recalc-plan.spec.ts
// ⭐ №170: тесты планировщика пересчёта (чистая логика, без БД).
import { Unit } from '@prisma/client';
import {
  buildRecalcPlan,
  normalizeText,
  RecalcMaterialRow,
  RecalcPriceRef,
} from './recalc-plan';

const work = (
  id: number,
  name: string,
  price: number,
  article: string | null = null,
): RecalcPriceRef => ({ id, name, article, unit: Unit.SQUARE_METER, price });

const material = (
  id: number,
  name: string,
  price: number,
  article: string | null = null,
): RecalcPriceRef => ({ id, name, article, unit: Unit.PIECE, price });

const row = (patch: Partial<RecalcMaterialRow> = {}): RecalcMaterialRow => ({
  id: 1,
  name: 'Штукатурка стен',
  article: null,
  unit: Unit.SQUARE_METER,
  specQuantity: 10,
  totalUsed: 0,
  priceItemId: 100,
  unitPrice: 500,
  materialItemId: null,
  materialUnitPrice: 0,
  ...patch,
});

describe('recalc-plan (№170)', () => {
  it('нормализует названия: регистр, ё, кавычки, пробелы', () => {
    expect(normalizeText('  Штукатурка  «Ёлочка» ')).toBe('штукатурка елочка');
  });

  it('меняет цену по прямой ссылке priceItemId', () => {
    const plan = buildRecalcPlan(
      [row()],
      [work(100, 'Любое название', 650)],
      [],
    );
    expect(plan.rows[0].work.match).toBe('id');
    expect(plan.rows[0].work.newPrice).toBe(650);
    expect(plan.rows[0].apply).toBe(true);
    expect(plan.summary.willUpdate).toBe(1);
    expect(plan.summary.delta).toBe(1500); // 10 м² × 150 ₽
  });

  it('подхватывает расценку по артикулу и пишет новую ссылку', () => {
    const plan = buildRecalcPlan(
      [row({ priceItemId: null, article: ' ШТ-01 ' })],
      [work(7, 'Другое имя', 700, 'шт-01')],
      [],
    );
    expect(plan.rows[0].work.match).toBe('article');
    expect(plan.rows[0].work.itemId).toBe(7);
    expect(plan.rows[0].work.newPrice).toBe(700);
  });

  it('подхватывает расценку по названию + единице', () => {
    const plan = buildRecalcPlan(
      [row({ priceItemId: null, name: 'ШТУКАТУРКА СТЕН' })],
      [work(9, 'штукатурка стен', 550)],
      [],
    );
    expect(plan.rows[0].work.match).toBe('name');
    expect(plan.rows[0].work.newPrice).toBe(550);
  });

  it('⭐ №337: пересчитывает и строку с фиксациями (старая защита убрана)', () => {
    const plan = buildRecalcPlan(
      [row({ totalUsed: 4 })],
      [work(100, 'Штукатурка стен', 900)],
      [],
    );
    expect(plan.rows[0].hasFacts).toBe(true);
    expect(plan.rows[0].apply).toBe(true);
    expect(plan.rows[0].reason).toBe('ok');
    expect(plan.summary.withFacts).toBe(1);
    expect(plan.summary.willUpdate).toBe(1);
    // 10 м² × 900 ₽ — план по строке пересчитан
    expect(plan.summary.planNew).toBe(9000);
    expect(plan.summary.planOld).toBe(5000);
  });

  it('⭐ №337: наценка на работы и скидка на материалы', () => {
    const plan = buildRecalcPlan(
      [row({ materialItemId: 55, materialUnitPrice: 100 })],
      [work(100, 'Штукатурка стен', 500)],
      [material(55, 'Штукатурка стен', 100)],
      { workMarkupPercent: 10, materialMarkupPercent: -5 },
    );
    expect(plan.rows[0].work.newPrice).toBe(550);
    expect(plan.rows[0].material.newPrice).toBe(95);
    expect(plan.rows[0].apply).toBe(true);
    // 10 × (550 + 95)
    expect(plan.summary.planNew).toBe(6450);
  });

  it('⭐ №337: наценка действует только на найденные расценки', () => {
    const plan = buildRecalcPlan(
      [row({ priceItemId: null, name: 'Нет такой работы' })],
      [work(1, 'Штукатурка стен', 600)],
      [],
      { workMarkupPercent: 50 },
    );
    expect(plan.rows[0].apply).toBe(false);
    expect(plan.rows[0].planNew).toBe(plan.rows[0].planOld);
  });

  it('неоднозначное совпадение по названию = ambiguous, цену не меняем', () => {
    const plan = buildRecalcPlan(
      [row({ priceItemId: null })],
      [work(1, 'Штукатурка стен', 600), work(2, 'Штукатурка стен', 700)],
      [],
    );
    expect(plan.rows[0].work.match).toBe('ambiguous');
    expect(plan.rows[0].apply).toBe(false);
    expect(plan.rows[0].reason).toBe('ambiguous');
    expect(plan.summary.notFound).toBe(1);
  });

  it('нет расценки в справочнике = missing, цена остаётся прежней', () => {
    const plan = buildRecalcPlan(
      [row({ priceItemId: null, name: 'Нет такой работы' })],
      [work(1, 'Штукатурка стен', 600)],
      [],
    );
    expect(plan.rows[0].work.match).toBe('missing');
    expect(plan.rows[0].reason).toBe('notFound');
    expect(plan.rows[0].planNew).toBe(plan.rows[0].planOld);
  });

  it('работы и материалы ищутся в своих наборах расценок', () => {
    const plan = buildRecalcPlan(
      [row({ materialItemId: 55, materialUnitPrice: 100 })],
      [work(100, 'Штукатурка стен', 500)],
      [material(55, 'Штукатурка стен', 120)],
    );
    // цена работы не изменилась, цена материала выросла на 20
    expect(plan.rows[0].work.changed).toBe(false);
    expect(plan.rows[0].material.changed).toBe(true);
    expect(plan.rows[0].apply).toBe(true);
    expect(plan.summary.planOld).toBe(6000); // 10 × (500 + 100)
    expect(plan.summary.planNew).toBe(6200); // 10 × (500 + 120)
  });

  it('цена уже совпадает — строку не пишем', () => {
    const plan = buildRecalcPlan(
      [row()],
      [work(100, 'Штукатурка стен', 500)],
      [],
    );
    expect(plan.rows[0].apply).toBe(false);
    expect(plan.rows[0].reason).toBe('same');
    expect(plan.summary.unchanged).toBe(1);
    expect(plan.summary.delta).toBe(0);
  });
});
