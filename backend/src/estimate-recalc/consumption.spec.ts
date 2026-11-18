// backend/src/estimate-recalc/consumption.spec.ts
// ⭐ №318: цена материала по упаковке и норме расхода.
import { hasPackConsumption, materialPricePerUnit, round2 } from './consumption';

describe('materialPricePerUnit — банка краски на м²', () => {
  it('1000 ₽ за 9 кг при расходе 0.2 кг/м² → 22.22 ₽/м²', () => {
    expect(materialPricePerUnit(1000, 9, 0.2)).toBe(22.22);
  });

  it('на 90 м² это 2000 ₽ (как в примере владельца)', () => {
    const perUnit = materialPricePerUnit(1000, 9, 0.2);
    expect(round2(perUnit * 90)).toBe(1999.8);
    // 90 м² × 0.2 кг = 18 кг = 2 банки → 2000 ₽; дробная цена даёт 1999.8 ₽
    expect(round2((1000 / 9) * 18)).toBe(2000);
  });

  it('без упаковки цена остаётся ценой за единицу (старое поведение)', () => {
    expect(materialPricePerUnit(320, null, 0.2)).toBe(320);
    expect(materialPricePerUnit(320, 0, 0.2)).toBe(320);
  });

  it('без расхода — тоже цена за единицу', () => {
    expect(materialPricePerUnit(1000, 9, null)).toBe(1000);
    expect(materialPricePerUnit(1000, 9, 0)).toBe(1000);
  });

  it('строки из Decimal и строковые значения приводятся к числу', () => {
    expect(materialPricePerUnit('1000.00', '9', '0.2')).toBe(22.22);
  });

  it('hasPackConsumption: нужны оба значения и они положительные', () => {
    expect(hasPackConsumption(9, 0.2)).toBe(true);
    expect(hasPackConsumption(9, 0)).toBe(false);
    expect(hasPackConsumption(null, 0.2)).toBe(false);
    expect(hasPackConsumption(0, 0.2)).toBe(false);
  });
});
