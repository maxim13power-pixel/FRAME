// backend/src/imports/unit-normalizer.ts
// ⭐ №202 (RFC §4.2): единицы измерения — самая опасная часть импорта.
// В системе ровно 10 единиц; «шт ≠ упак ≠ мешок», автоконвертации нет.
// Неизвестная/пустая единица → null (строка получает ошибку, а не молчаливый PIECE).
import { Unit } from '@prisma/client';

/** Синонимы → enum. Ключи уже нормализованы (lowercase, без точек в конце). */
const UNIT_SYNONYMS: Record<string, Unit> = {
  шт: Unit.PIECE,
  штук: Unit.PIECE,
  штука: Unit.PIECE,
  штуки: Unit.PIECE,
  pcs: Unit.PIECE,
  pc: Unit.PIECE,
  м: Unit.METER,
  метр: Unit.METER,
  метров: Unit.METER,
  погм: Unit.METER,
  пм: Unit.METER,
  мп: Unit.METER,
  m: Unit.METER,
  м2: Unit.SQUARE_METER,
  'м²': Unit.SQUARE_METER,
  квм: Unit.SQUARE_METER,
  мкв: Unit.SQUARE_METER,
  m2: Unit.SQUARE_METER,
  м3: Unit.CUBIC_METER,
  'м³': Unit.CUBIC_METER,
  кубм: Unit.CUBIC_METER,
  мкуб: Unit.CUBIC_METER,
  m3: Unit.CUBIC_METER,
  кг: Unit.KILOGRAM,
  килограмм: Unit.KILOGRAM,
  kg: Unit.KILOGRAM,
  л: Unit.LITER,
  литр: Unit.LITER,
  l: Unit.LITER,
  т: Unit.TON,
  тн: Unit.TON,
  тонна: Unit.TON,
  ton: Unit.TON,
  меш: Unit.BAG,
  мешок: Unit.BAG,
  мешки: Unit.BAG,
  bag: Unit.BAG,
  упак: Unit.PACKAGE,
  уп: Unit.PACKAGE,
  пач: Unit.PACKAGE,
  пачка: Unit.PACKAGE,
  pack: Unit.PACKAGE,
  компл: Unit.SET,
  кт: Unit.SET,
  набор: Unit.SET,
  set: Unit.SET,
};

/** Погонные метры приводим к METER приблизительно — в предпросмотре это флаг. */
const APPROX_KEYS = new Set(['погм', 'пм', 'мп']);

export interface UnitParseResult {
  unit: Unit | null;
  /** единица приведена приблизительно (пог. м → м) */
  approx: boolean;
}

export const normalizeUnit = (raw: unknown): UnitParseResult => {
  if (raw == null) return { unit: null, approx: false };
  const key = String(raw)
    .normalize('NFKC')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[\s\u00A0\u202F]+/g, '')
    .replace(/[.,;:()]/g, '')
    .replace(/^ед(изм|иница)?/, '');
  if (!key) return { unit: null, approx: false };

  const direct = UNIT_SYNONYMS[key];
  if (direct) return { unit: direct, approx: APPROX_KEYS.has(key) };

  // «м.кв.», «куб. м» → уже схлопнуто; «1000 шт» не поддерживаем (нет коэффициента)
  const stripped = key.replace(/^(в|на)/, '');
  const fallback = UNIT_SYNONYMS[stripped];
  if (fallback) return { unit: fallback, approx: APPROX_KEYS.has(stripped) };

  return { unit: null, approx: false };
};

export const unitLabelRu = (unit: Unit | null): string => {
  switch (unit) {
    case Unit.PIECE: return 'шт';
    case Unit.METER: return 'м';
    case Unit.SQUARE_METER: return 'м²';
    case Unit.CUBIC_METER: return 'м³';
    case Unit.KILOGRAM: return 'кг';
    case Unit.LITER: return 'л';
    case Unit.TON: return 'т';
    case Unit.BAG: return 'мешок';
    case Unit.PACKAGE: return 'упак';
    case Unit.SET: return 'компл';
    default: return '';
  }
};
