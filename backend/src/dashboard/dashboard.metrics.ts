// backend/src/dashboard/dashboard.metrics.ts
// ⭐ №225 (§71, №118): ОБЪЁМЫ и ДЕНЬГИ — разные сущности.
// Раньше `percent` в ответе дашборда считался как totalUsed / specQuantity (это
// объёмы) и уезжал внутрь блока `money`. UI читал `data.money.percent` и подписывал
// его как «+864 % перерасход» — цифра честная, а формулировка нет.
// Теперь объём живёт в своём блоке (`volume`), а деньги сравниваются со сметой:
//   объём  → «объём перевыполнен на N %» (N = round((percent − 1) · 100));
//   деньги → «факт больше сметы на X ₽ (Y %)» либо «в пределах сметы».

/** Денежные суммы округляем до копеек — API не должен отдавать float-хвосты. */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** ⭐ №231: лимит списка «без расценки» (1..200, по умолчанию 5). */
export function normalizeNoPriceLimit(raw: number): number {
  return Math.min(Math.max(Math.trunc(Number.isFinite(raw) ? raw : 5), 1), 200);
}

/** Процент с одним знаком после запятой (как в аналитике). */
function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function finite(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

export interface VolumeMetrics {
  /** Σ totalUsed по всем доступным объектам (объёмы, не деньги). */
  used: number;
  /** Σ specQuantity по всем доступным объектам. */
  specQuantity: number;
  /** totalUsed / specQuantity без верхнего клампа (может быть > 1); 0 при пустой спецификации. */
  percent: number;
  /**
   * На сколько процентов объём ПЕРЕВЫПОЛНЕН; null — перевыполнения нет.
   * Порог строгий: ровно 100 % (percent = 1) — это «в плане», бейджа нет.
   * Если перевыполнение меньше 0,5 % (округление даёт 0), бейдж тоже не показываем.
   */
  overrunPercent: number | null;
}

/**
 * Прогресс объёмов и признак перевыполнения.
 * Пустая спецификация (0) не даёт деления на ноль — percent = 0.
 */
export function buildVolumeMetrics(
  used: number,
  specQuantity: number,
): VolumeMetrics {
  const safeUsed = finite(used);
  const safeSpec = finite(specQuantity);
  const percent = safeSpec > 0 ? safeUsed / safeSpec : 0;
  if (!(percent > 1)) {
    return { used: safeUsed, specQuantity: safeSpec, percent, overrunPercent: null };
  }
  const overrunPercent = Math.round((percent - 1) * 100);
  return {
    used: safeUsed,
    specQuantity: safeSpec,
    percent,
    // 0 % — это не «перевыполнение», а погрешность округления
    overrunPercent: overrunPercent > 0 ? overrunPercent : null,
  };
}

export interface MoneyMetrics {
  /** Смета = Σ (unitPrice + materialUnitPrice) × specQuantity. */
  estimate: number;
  /** Факт = Σ (totalCost + materialTotalCost). */
  actual: number;
  /** Факт − смета (отрицательное значение = экономия). */
  difference: number;
  /** Факт от сметы в процентах (1 знак); null — сметы нет (делить нельзя). */
  percentOfEstimate: number | null;
  /** true — факт больше сметы (денежный перерасход). */
  overBudget: boolean;
  /** На сколько процентов факт больше сметы; null — перерасхода нет или смета = 0. */
  overPercent: number | null;
}

/**
 * Денежное сравнение «факт vs смета».
 * Смета = 0 при факте > 0 — это НЕ бесконечный процент: overBudget = true,
 * а проценты остаются null (в UI пишем сумму без процента).
 */
export function buildMoneyMetrics(estimate: number, actual: number): MoneyMetrics {
  const safeEstimate = round2(finite(estimate));
  const safeActual = round2(finite(actual));
  const difference = round2(safeActual - safeEstimate);
  const overBudget = safeActual > safeEstimate;
  return {
    estimate: safeEstimate,
    actual: safeActual,
    difference,
    percentOfEstimate: safeEstimate > 0 ? round1(safeActual / safeEstimate * 100) : null,
    overBudget,
    overPercent:
      overBudget && safeEstimate > 0 ? round1(difference / safeEstimate * 100) : null,
  };
}
