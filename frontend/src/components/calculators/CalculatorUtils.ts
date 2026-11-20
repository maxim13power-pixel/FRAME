export const formatNumber = (value: number) =>
  Number.isFinite(value)
    ? value.toLocaleString('ru-RU', { maximumFractionDigits: 2 })
    : '—';

/** ⭐ №366: все значения должны быть положительными числами (иначе результат не считаем) */
export const allPositive = (...values: number[]) =>
  values.every((value) => Number.isFinite(value) && value > 0);
