// backend/src/imports/price-matcher.ts
// ⭐ №202 (RFC §7.2–7.3): каскад сопоставления строки файла с расценкой справочника.
// Чистая функция: БД только поставляет каталог. Никаких «содержит» и никаких
// автопривязок при score < 0.85 — ложная склейка дороже пропущенной строки.
import { Unit } from '@prisma/client';
import {
  extractNumbers,
  normalizeArticle,
  normalizeText,
  significantTokens,
} from './name-normalizer';
import type { CatalogItem, MatchCandidate, RowMatch } from './imports.types';

const jaccard = (a: string[], b: string[]): number => {
  if (a.length === 0 || b.length === 0) return 0;
  const sa = new Set(a);
  const sb = new Set(b);
  let inter = 0;
  sa.forEach((t) => {
    if (sb.has(t)) inter += 1;
  });
  return inter / (sa.size + sb.size - inter);
};

const trigrams = (s: string): Set<string> => {
  const padded = `  ${s}  `;
  const out = new Set<string>();
  for (let i = 0; i < padded.length - 2; i += 1) out.add(padded.slice(i, i + 3));
  return out;
};

const dice = (a: string, b: string): number => {
  const ta = trigrams(a);
  const tb = trigrams(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  ta.forEach((t) => {
    if (tb.has(t)) inter += 1;
  });
  return (2 * inter) / (ta.size + tb.size);
};

export interface MatchInput {
  name: string;
  article: string | null;
  unit: Unit | null;
}

/** score = 0.6×Jaccard + 0.4×Dice с штрафами по числам и единице. */
const scorePair = (input: MatchInput, item: CatalogItem): number => {
  const aTokens = significantTokens(input.name);
  const bTokens = significantTokens(item.name);
  let score = 0.6 * jaccard(aTokens, bTokens) + 0.4 * dice(normalizeText(input.name), normalizeText(item.name));

  const aNums = extractNumbers(input.name);
  const bNums = extractNumbers(item.name);
  if (aNums.length > 0 || bNums.length > 0) {
    const same =
      aNums.length === bNums.length && [...aNums].sort().join(',') === [...bNums].sort().join(',');
    if (!same) score = Math.min(score, 0.5);
  }
  if (input.unit && item.unit !== input.unit) score = Math.min(score, 0.4);
  return Math.round(score * 100) / 100;
};

const toCandidate = (item: CatalogItem, score: number): MatchCandidate => ({
  id: item.id,
  name: item.name,
  score,
  category: item.category,
});

/**
 * Подбирает расценку для строки.
 * EXACT — можно не спрашивать; FUZZY — предлагаем, но требуем подтверждения;
 * SUGGESTED — только подсказка; NONE — новой расценки нет.
 */
export const matchRow = (input: MatchInput, catalog: CatalogItem[], limit = 200): RowMatch => {
  const none: RowMatch = { status: 'NONE', priceItemId: null, price: null, score: 0, candidates: [] };
  if (!input.name.trim() || catalog.length === 0) return none;

  // Шаг 0: артикул — самый надёжный ключ
  const articleNorm = normalizeArticle(input.article);
  if (articleNorm) {
    const byArticle = catalog.find(
      (c) => normalizeArticle(c.article) === articleNorm && (!input.unit || c.unit === input.unit),
    );
    if (byArticle) {
      return {
        status: 'EXACT',
        priceItemId: byArticle.id,
        price: byArticle.price,
        score: 1,
        candidates: [toCandidate(byArticle, 1)],
      };
    }
  }

  const inputNorm = normalizeText(input.name);
  if (!inputNorm) return none;

  // Шаг 1: точное совпадение названия + совместимая единица
  const exact = catalog.find(
    (c) => normalizeText(c.name) === inputNorm && (!input.unit || c.unit === input.unit),
  );
  if (exact) {
    return {
      status: 'EXACT',
      priceItemId: exact.id,
      price: exact.price,
      score: 1,
      candidates: [toCandidate(exact, 1)],
    };
  }

  // Предфильтр: приличные кандидаты по токенам (не более `limit` штук)
  const firstToken = significantTokens(input.name)[0]?.slice(0, 3);
  const pool = catalog
    .filter((c) => (input.unit ? c.unit === input.unit : true))
    .filter((c) => (firstToken ? normalizeText(c.name).includes(firstToken) : true))
    .slice(0, limit);
  const scored = (pool.length > 0 ? pool : catalog.slice(0, limit))
    .map((item) => ({ item, score: scorePair(input, item) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  if (scored.length === 0 || scored[0].score < 0.65) return none;

  const best = scored[0];
  const close = scored.filter((s) => best.score - s.score <= 0.05 && s.score >= 0.65);
  const candidates = scored.map((s) => toCandidate(s.item, s.score));

  // Два почти равных кандидата — не выбираем сами (RFC §7.3)
  if (close.length > 1) {
    return { status: 'SUGGESTED', priceItemId: null, price: null, score: best.score, candidates };
  }

  if (best.score >= 0.85) {
    return {
      status: 'FUZZY',
      priceItemId: best.item.id,
      price: best.item.price,
      score: best.score,
      candidates,
    };
  }

  return { status: 'SUGGESTED', priceItemId: null, price: null, score: best.score, candidates };
};
