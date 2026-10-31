// backend/src/imports/name-normalizer.ts
// ⭐ №202 (RFC §7.1): одна нормализация для парсера и матчера.
import { normalizeUnit } from './unit-normalizer';
import type { Unit } from '@prisma/client';

/** Стоп-токены: не влияют на схожесть, но остаются в названии. */
const STOP_TOKENS = new Set([
  'устройство', 'монтаж', 'установка', 'работы', 'работа', 'выполнение',
  'согласно', 'проекту', 'всего', 'итого', 'далее',
]);

/** NFKC, trim, lowercase, ё→е, любые пробелы → один. */
export const normalizeText = (value: unknown): string =>
  String(value ?? '')
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[\s\u00A0\u202F\u2009]+/g, ' ');

/** Разделители → пробел, числа остаются числами. */
export const tokenize = (value: unknown): string[] =>
  normalizeText(value)
    .replace(/,([0-9])/g, '.$1') // 12,5 → 12.5
    .replace(/[.;:/\\|—–]/g, ' ')
    .replace(/-/g, ' ')
    .split(' ')
    .map((t) => t.trim())
    .filter(Boolean);

/** Значимые токены для скоринга (без стоп-слов). */
export const significantTokens = (value: unknown): string[] =>
  tokenize(value).filter((t) => !STOP_TOKENS.has(t));

/** Числа в названии: «стяжка 50 мм» ≠ «стяжка 100 мм». */
export const extractNumbers = (value: unknown): string[] =>
  tokenize(value)
    .map((t) => t.replace(',', '.'))
    .filter((t) => /^\d+(\.\d+)?$/.test(t))
    .map((t) => String(Number(t)));

/** Артикул: uppercase, только буквы/цифры. */
export const normalizeArticle = (value: unknown): string | null => {
  const raw = String(value ?? '').normalize('NFKC').toUpperCase();
  const cleaned = raw.replace(/[^A-Z0-9А-Я]/g, '');
  return cleaned || null;
};

/** Кириллица в артикуле — предупреждение для предпросмотра. */
export const articleHasCyrillic = (value: unknown): boolean =>
  /[А-ЯЁ]/i.test(String(value ?? ''));

/** «1 234,56» → 1234.56; мусор → null. */
export const parseNumberRu = (value: unknown): number | null => {
  if (value == null) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  let s = String(value).normalize('NFKC').replace(/[\s\u00A0\u202F]/g, '').replace(/[₽р]/gi, '');
  if (!s) return null;
  const hasComma = s.includes(',');
  const hasDot = s.includes('.');
  if (hasComma && hasDot) {
    // «1.234,56» — точка как разделитель тысяч
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (hasComma) {
    s = s.replace(',', '.');
  }
  s = s.replace(/[^0-9.\-]/g, '');
  if (!s || s === '-' || s === '.') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

/** Единица из строки файла (для парсера). */
export const parseUnit = (value: unknown): { unit: Unit | null; approx: boolean } =>
  normalizeUnit(value);

/**
 * ⭐ №214: имя файла из multipart.
 * multer 2.0.2 (busboy) декодирует `filename="…"` как latin1, а браузер присылает байты
 * UTF-8 — «Шаблон сметы FRAME.xlsx» превращалось в «Ð¨Ð°Ð±Ð»Ð¾Ð½ ÑÐ¼ÐµÑÑ…» и попадало
 * в название нового справочника цен. Перекодируем обратно ТОЛЬКО если это действительно
 * мойибаке и результат — корректный UTF-8 (иначе имя уже нормальное, например латиница).
 */
export const fixMultipartFileName = (name: string): string => {
  if (!name || !/[\u0080-\u00FF]/.test(name)) return name;
  const repaired = Buffer.from(name, 'latin1').toString('utf8');
  if (!repaired || repaired.includes('\uFFFD')) return name;
  return repaired;
};
