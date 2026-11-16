// backend/src/imports/unit-normalizer.spec.ts
import { Unit } from '@prisma/client';
import {
  normalizeUnit,
  sameUnitFamily,
  unitFamily,
  unitsInFamily,
} from './unit-normalizer';

describe('normalizeUnit — единицы из Excel', () => {
  it('понимает мтр / м.тр. как метр', () => {
    expect(normalizeUnit('мтр').unit).toBe(Unit.METER);
    expect(normalizeUnit('м.тр.').unit).toBe(Unit.METER);
  });

  it('понимает частые варианты м² и м³', () => {
    expect(normalizeUnit('кв.м').unit).toBe(Unit.SQUARE_METER);
    expect(normalizeUnit('м2').unit).toBe(Unit.SQUARE_METER);
    expect(normalizeUnit('куб.м').unit).toBe(Unit.CUBIC_METER);
    expect(normalizeUnit('м3').unit).toBe(Unit.CUBIC_METER);
  });

  it('не угадывает неизвестное молча', () => {
    expect(normalizeUnit('вагон').unit).toBeNull();
  });

  describe('⭐ №272: погонный метр', () => {
    it.each(['пог.м', 'пог. м', 'п.м.', 'пм', 'мп', 'п.м.п.', 'ПОГОННЫЙ МЕТР'])(
      '«%s» → LINEAR_METER (точное совпадение)',
      (raw) => {
        expect(normalizeUnit(raw)).toEqual({ unit: Unit.LINEAR_METER, approx: false });
      },
    );

    it('простой метр остаётся метром, а не погонным', () => {
      expect(normalizeUnit('м')).toEqual({ unit: Unit.METER, approx: false });
      expect(normalizeUnit('метр')).toEqual({ unit: Unit.METER, approx: false });
    });
  });

  describe('порядок правил: ловушки', () => {
    it('«компл» — комплект, хотя содержит «мп»', () => {
      expect(normalizeUnit('компл').unit).toBe(Unit.SET);
      expect(normalizeUnit('комплект').unit).toBe(Unit.SET);
    });

    it('«кв.м» и «куб.м» не становятся метром', () => {
      expect(normalizeUnit('кв. м').unit).toBe(Unit.SQUARE_METER);
      expect(normalizeUnit('куб. м').unit).toBe(Unit.CUBIC_METER);
    });

    it('«кг» не становится площадью', () => {
      expect(normalizeUnit('кг').unit).toBe(Unit.KILOGRAM);
      expect(normalizeUnit('килограмм').unit).toBe(Unit.KILOGRAM);
    });
  });

  describe('подписи цены', () => {
    it('«руб/м2» и «₽/шт» — это единица, а не ставка', () => {
      expect(normalizeUnit('руб/м2').unit).toBe(Unit.SQUARE_METER);
      expect(normalizeUnit('₽/шт').unit).toBe(Unit.PIECE);
    });

    it('«цена за м2» и «м2 с НДС»', () => {
      expect(normalizeUnit('цена за м2').unit).toBe(Unit.SQUARE_METER);
      expect(normalizeUnit('м2 с НДС').unit).toBe(Unit.SQUARE_METER);
    });

    it('«кг/м» — ставка, а не единица', () => {
      expect(normalizeUnit('кг/м').unit).toBeNull();
    });
  });

  describe('тара → штука (решение владельца 16.11.2026)', () => {
    it.each(['рулон', 'бухта', 'лист', 'ведро', 'банка', 'пара'])(
      '«%s» → PIECE с пометкой «приблизительно»',
      (raw) => {
        expect(normalizeUnit(raw)).toEqual({ unit: Unit.PIECE, approx: true });
      },
    );
  });

  it('число внутри единицы не угадываем: «1000 шт» → null', () => {
    expect(normalizeUnit('1000 шт').unit).toBeNull();
    expect(normalizeUnit('10 м').unit).toBeNull();
  });

  it('«ед.» — штука приблизительно', () => {
    expect(normalizeUnit('ед.')).toEqual({ unit: Unit.PIECE, approx: true });
  });

  it('«упаковка» и «пачка» — упак, «набор» — компл', () => {
    expect(normalizeUnit('упаковка').unit).toBe(Unit.PACKAGE);
    expect(normalizeUnit('пачка').unit).toBe(Unit.PACKAGE);
    expect(normalizeUnit('набор').unit).toBe(Unit.SET);
  });
});

describe('unitFamily — совместимость единиц при матчинге', () => {
  it('«м» и «пог. м» — одно семейство', () => {
    expect(sameUnitFamily(Unit.METER, Unit.LINEAR_METER)).toBe(true);
    expect(unitFamily(Unit.LINEAR_METER)).toBe('LENGTH');
    expect(unitsInFamily(Unit.METER)).toEqual([Unit.METER, Unit.LINEAR_METER]);
  });

  it('кг и тонна — разные семейства (иначе ошибка в 1000 раз)', () => {
    expect(sameUnitFamily(Unit.KILOGRAM, Unit.TON)).toBe(false);
  });

  it('мешок и упаковка — разные семейства', () => {
    expect(sameUnitFamily(Unit.BAG, Unit.PACKAGE)).toBe(false);
  });

  it('литр не совместим с кубометром', () => {
    expect(sameUnitFamily(Unit.LITER, Unit.CUBIC_METER)).toBe(false);
  });
});

