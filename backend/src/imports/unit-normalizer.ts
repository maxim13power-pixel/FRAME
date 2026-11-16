// backend/src/imports/unit-normalizer.ts
// ⭐ №202 (RFC §4.2): единицы измерения — самая опасная часть импорта.
// В системе ровно 10 единиц; «шт ≠ упак ≠ мешок», автоконвертации нет.
// Неизвестная/пустая единица → null (строка получает ошибку, а не молчаливый PIECE).
import { Unit } from '@prisma/client';

/** Синонимы → enum. Ключи уже «компактные»: lowercase, без пробелов и пунктуации. */
const UNIT_SYNONYMS: Record<string, Unit> = {
  // штука
  шт: Unit.PIECE,
  штук: Unit.PIECE,
  штука: Unit.PIECE,
  штуки: Unit.PIECE,
  штка: Unit.PIECE,
  штучка: Unit.PIECE,
  pcs: Unit.PIECE,
  pc: Unit.PIECE,
  pce: Unit.PIECE,
  piece: Unit.PIECE,
  ea: Unit.PIECE,
  each: Unit.PIECE,
  // «единица» без физического смысла — приблизительно штука
  ед: Unit.PIECE,
  единица: Unit.PIECE,
  единиц: Unit.PIECE,
  единицы: Unit.PIECE,
  услед: Unit.PIECE,
  // ⭐ №272: тарных единиц в enum нет — считаем штуками (решение владельца 16.11.2026)
  рулон: Unit.PIECE,
  рулоны: Unit.PIECE,
  рул: Unit.PIECE,
  бухта: Unit.PIECE,
  бухты: Unit.PIECE,
  бухт: Unit.PIECE,
  катушка: Unit.PIECE,
  катушки: Unit.PIECE,
  бобина: Unit.PIECE,
  лист: Unit.PIECE,
  листы: Unit.PIECE,
  листов: Unit.PIECE,
  ведро: Unit.PIECE,
  ведра: Unit.PIECE,
  банка: Unit.PIECE,
  бутылка: Unit.PIECE,
  тюбик: Unit.PIECE,
  пара: Unit.PIECE,
  пары: Unit.PIECE,
  связка: Unit.PIECE,
  пучок: Unit.PIECE,
  блок: Unit.PIECE,
  roll: Unit.PIECE,
  coil: Unit.PIECE,
  sheet: Unit.PIECE,
  pair: Unit.PIECE,
  // метр
  м: Unit.METER,
  метр: Unit.METER,
  метра: Unit.METER,
  метров: Unit.METER,
  мтр: Unit.METER,
  m: Unit.METER,
  meter: Unit.METER,
  metre: Unit.METER,
  lm: Unit.METER,
  // ⭐ №272: погонный метр — отдельная единица, не «приблизительный метр»
  пм: Unit.LINEAR_METER,
  мп: Unit.LINEAR_METER,
  пмп: Unit.LINEAR_METER,
  погм: Unit.LINEAR_METER,
  погонныйметр: Unit.LINEAR_METER,
  // площадь
  м2: Unit.SQUARE_METER,
  'м²': Unit.SQUARE_METER,
  квм: Unit.SQUARE_METER,
  мкв: Unit.SQUARE_METER,
  квметр: Unit.SQUARE_METER,
  квадратныйметр: Unit.SQUARE_METER,
  m2: Unit.SQUARE_METER,
  sqm: Unit.SQUARE_METER,
  // объём
  м3: Unit.CUBIC_METER,
  'м³': Unit.CUBIC_METER,
  кубм: Unit.CUBIC_METER,
  мкуб: Unit.CUBIC_METER,
  кубметр: Unit.CUBIC_METER,
  кубическийметр: Unit.CUBIC_METER,
  куб: Unit.CUBIC_METER,
  m3: Unit.CUBIC_METER,
  cubic: Unit.CUBIC_METER,
  // масса
  кг: Unit.KILOGRAM,
  килограмм: Unit.KILOGRAM,
  килограммов: Unit.KILOGRAM,
  килограм: Unit.KILOGRAM,
  kg: Unit.KILOGRAM,
  kgs: Unit.KILOGRAM,
  kilo: Unit.KILOGRAM,
  // объём жидкости — отдельно от м³: литр и кубометр отличаются в 1000 раз
  л: Unit.LITER,
  литр: Unit.LITER,
  литров: Unit.LITER,
  литры: Unit.LITER,
  лтр: Unit.LITER,
  l: Unit.LITER,
  liter: Unit.LITER,
  litre: Unit.LITER,
  lit: Unit.LITER,
  // тонна
  т: Unit.TON,
  тн: Unit.TON,
  тонна: Unit.TON,
  тонн: Unit.TON,
  тонны: Unit.TON,
  тон: Unit.TON,
  ton: Unit.TON,
  tonne: Unit.TON,
  tn: Unit.TON,
  mt: Unit.TON,
  // мешок
  меш: Unit.BAG,
  мешок: Unit.BAG,
  мешков: Unit.BAG,
  мешки: Unit.BAG,
  bag: Unit.BAG,
  sack: Unit.BAG,
  // упаковка
  упак: Unit.PACKAGE,
  упаковка: Unit.PACKAGE,
  упаковок: Unit.PACKAGE,
  уп: Unit.PACKAGE,
  пач: Unit.PACKAGE,
  пачка: Unit.PACKAGE,
  пачек: Unit.PACKAGE,
  pack: Unit.PACKAGE,
  pkg: Unit.PACKAGE,
  package: Unit.PACKAGE,
  коробка: Unit.PACKAGE,
  кор: Unit.PACKAGE,
  box: Unit.PACKAGE,
  // комплект
  компл: Unit.SET,
  комплект: Unit.SET,
  комплектов: Unit.SET,
  кт: Unit.SET,
  набор: Unit.SET,
  наборов: Unit.SET,
  set: Unit.SET,
  kit: Unit.SET,
};

/**
 * Приблизительные сопоставления: подпись не является физической единицей
 * (тара, «ед.», сленговое «куб»). В UI такие строки помечаются «≈».
 */
const APPROX_KEYS = new Set([
  'ед',
  'единица',
  'единиц',
  'единицы',
  'услед',
  'рулон',
  'рулоны',
  'рул',
  'бухта',
  'бухты',
  'бухт',
  'катушка',
  'катушки',
  'бобина',
  'лист',
  'листы',
  'листов',
  'ведро',
  'ведра',
  'банка',
  'бутылка',
  'тюбик',
  'пара',
  'пары',
  'связка',
  'пучок',
  'блок',
  'roll',
  'coil',
  'sheet',
  'pair',
  'куб',
]);

/** «руб/м2», «₽/шт»: валюта перед слэшем — обёртка цены, а не составная единица. */
const CURRENCY_TOKENS = new Set(['руб', 'р', '₽', 'rub', 'рубль', 'рублей', 'росруб']);

/**
 * ⭐ №272: упорядоченные правила — от частного к общему.
 * Порядок критичен: «компл» содержит «мп», «кв.м» и «куб.м» содержат «м»,
 * «погонный метр» содержит «метр». Поэтому SET/PACKAGE/BAG/площадь/объём — раньше,
 * а METER — последним.
 */
const FALLBACK_RULES: { re: RegExp; unit: Unit; approx?: boolean }[] = [
  { re: /компл|набор|^кт$|set|kit/, unit: Unit.SET },
  { re: /упак|^уп$|пач|pack|pkg|короб|^кор$|^box$/, unit: Unit.PACKAGE },
  { re: /меш|bag|sack/, unit: Unit.BAG },
  { re: /кв|квадр|м2|мкв|sqm|square/, unit: Unit.SQUARE_METER },
  { re: /куб|м3|мкуб|cubic|^cum$/, unit: Unit.CUBIC_METER, approx: true },
  { re: /кг|килограм|kilo|^kgs?$/, unit: Unit.KILOGRAM },
  { re: /^т$|^тн$|тонн|^тон$|ton/, unit: Unit.TON },
  { re: /литр|^л$|^l$|liter|litre/, unit: Unit.LITER },
  { re: /шт|штук|pcs|^pce?$|each|piece|^ед$|единиц/, unit: Unit.PIECE },
  { re: /пог|погон|^пм$|^мп$|^пмп$|пмтр/, unit: Unit.LINEAR_METER },
  { re: /метр|мтр|^м$|^m$|^lm$|meter|metre/, unit: Unit.METER },
];

export interface UnitParseResult {
  unit: Unit | null;
  /** единица приведена приблизительно (пог. м → м) */
  approx: boolean;
}

/** «компактный» токен: без пробелов, точек, скобок, кавычек и дефисов */
const compactToken = (value: string): string =>
  value.replace(/[\s.,;:()\[\]{}"'«»„“”`\-–—_/*+№]/g, '');

export const normalizeUnit = (raw: unknown): UnitParseResult => {
  if (raw == null) return { unit: null, approx: false };
  let text = String(raw)
    .normalize('NFKC')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/[\u00A0\u202F]/g, ' ')
    .trim();
  if (!text) return { unit: null, approx: false };

  // «цена за м2», «м2 с НДС» → оставляем только единицу
  text = text
    .replace(/^(цена|стоимость)\s*(за)?\s*/, '')
    .replace(/\s*(с|без)\s*ндс.*$/, '');

  // «руб/м2», «₽/шт» → единица после слэша. «кг/м», «м2/шт» — это ставки, не единицы
  if (text.includes('/')) {
    const parts = text.split('/');
    const head = compactToken(parts.slice(0, -1).join('/'));
    const tail = compactToken(parts[parts.length - 1]);
    if (!CURRENCY_TOKENS.has(head)) return { unit: null, approx: false };
    text = tail;
  }

  const key = compactToken(text);
  if (!key) return { unit: null, approx: false };

  // «1000 шт» пока не поддерживаем: цена за 1000, принятая за цену за штуку,
  // — ошибка в 1000 раз. Такие строки уходят в «требует уточнения».
  if (/\d/.test(key.replace(/^(м|m)[23]$/, ''))) return { unit: null, approx: false };

  const direct = UNIT_SYNONYMS[key];
  if (direct) return { unit: direct, approx: APPROX_KEYS.has(key) };

  for (const rule of FALLBACK_RULES) {
    if (rule.re.test(key)) return { unit: rule.unit, approx: rule.approx === true };
  }
  return { unit: null, approx: false };
};

/**
 * ⭐ №272: семейство единиц. Совместимы только «м» и «пог. м» — для сметы это длина,
 * отличается лишь подпись. Кг и тонна, мешок и упаковка — РАЗНЫЕ семейства: иначе
 * пересчёт подставит цену за тонну в строку в килограммах (ошибка в 1000 раз).
 */
export type UnitFamily = 'LENGTH' | Unit;

const UNIT_FAMILY: Record<Unit, UnitFamily> = {
  PIECE: Unit.PIECE,
  METER: 'LENGTH',
  LINEAR_METER: 'LENGTH',
  SQUARE_METER: Unit.SQUARE_METER,
  CUBIC_METER: Unit.CUBIC_METER,
  KILOGRAM: Unit.KILOGRAM,
  LITER: Unit.LITER,
  TON: Unit.TON,
  BAG: Unit.BAG,
  PACKAGE: Unit.PACKAGE,
  SET: Unit.SET,
};

export const unitFamily = (unit: Unit): UnitFamily => UNIT_FAMILY[unit];

export const sameUnitFamily = (a: Unit, b: Unit): boolean =>
  unitFamily(a) === unitFamily(b);

/** Все единицы семейства — для SQL-фильтра `unit IN (...)` */
export const unitsInFamily = (unit: Unit): Unit[] =>
  (Object.keys(UNIT_FAMILY) as Unit[]).filter(
    (candidate) => UNIT_FAMILY[candidate] === UNIT_FAMILY[unit],
  );

export const unitLabelRu = (unit: Unit | null): string => {
  switch (unit) {
    case Unit.PIECE: return 'шт';
    case Unit.METER: return 'м';
    case Unit.LINEAR_METER: return 'пог. м'; // ⭐ №272
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
