// frontend/src/utils/decimal.ts
// ⭐ Шаг 103 (P1-3): бэкенд хранит деньги/объёмы в DECIMAL, Prisma сериализует их в JSON
// как СТРОКУ ("123.45"), а не число. Всё, что приходит с API, приводим к number здесь —
// до того, как данные попадут в UI (иначе «100.00» + «50.00» = «100.0050.00»).

/**
 * Безопасно приводит Decimal-значение с бэкенда (строка | число | null) к number.
 * Мусор/null/undefined → fallback (по умолчанию 0).
 */
export const parseDecimal = (value: unknown, fallback = 0): number => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : fallback;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
};