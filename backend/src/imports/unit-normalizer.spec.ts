// backend/src/imports/unit-normalizer.spec.ts
import { Unit } from '@prisma/client';
import { normalizeUnit } from './unit-normalizer';

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
});
