// backend/src/price-list/catalog-copy.spec.ts
import { PriceKind } from '@prisma/client';
import { markupPrice, normalizeMarkup } from './catalog-copy';

describe('копия справочника — наценка', () => {
  const markup = { workPercent: 15, materialPercent: 7 };

  it('наценка на работы и материалы считается раздельно', () => {
    expect(markupPrice(1000, PriceKind.WORK, markup)).toBe(1150);
    expect(markupPrice(1000, PriceKind.MATERIAL, markup)).toBe(1070);
  });

  it('округляет до копеек', () => {
    expect(markupPrice(123.456, PriceKind.MATERIAL, { workPercent: 0, materialPercent: 10 })).toBe(135.8);
  });

  it('отрицательная наценка — скидка', () => {
    expect(markupPrice(1000, PriceKind.WORK, { workPercent: -10, materialPercent: 0 })).toBe(900);
  });

  it('не допускает отрицательную цену', () => {
    expect(markupPrice(100, PriceKind.WORK, { workPercent: -90, materialPercent: 0 })).toBe(10);
    expect(markupPrice(0.01, PriceKind.WORK, { workPercent: -90, materialPercent: 0 })).toBe(0);
  });

  it('нормализует границы процентов', () => {
    expect(normalizeMarkup(-500)).toBe(-90);
    expect(normalizeMarkup(9999)).toBe(500);
    expect(normalizeMarkup('abc')).toBe(0);
  });
});
