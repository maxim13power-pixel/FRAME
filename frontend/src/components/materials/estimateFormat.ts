// frontend/src/components/materials/estimateFormat.ts
// ⭐ №393: форматирование денег и единиц для сметы. Отдельный файл (а не вместе
// с `InlinePriceEditor`), чтобы `react-refresh` не ругался на смесь компонента и констант.

/**
 * ⭐ №241: деньги на одной строке. Разряды `ru-RU` уже разделены неразрывным пробелом,
 * а перед «₽» стоял обычный пробел — из-за него валюта переносилась на новую строку.
 */
export const rub = (value: number): string => `${value.toLocaleString('ru-RU')}\u00A0₽`;

export const UNIT_OPTIONS = [
  { value: 'PIECE', label: 'шт' },
  { value: 'METER', label: 'м' },
  { value: 'LINEAR_METER', label: 'пог. м' },
  { value: 'SQUARE_METER', label: 'м²' },
  { value: 'CUBIC_METER', label: 'м³' },
  { value: 'KILOGRAM', label: 'кг' },
  { value: 'LITER', label: 'л' },
  { value: 'TON', label: 'т' },
  { value: 'BAG', label: 'мешок' },
  { value: 'PACKAGE', label: 'упак' },
  { value: 'SET', label: 'компл' },
];

/** Подпись единицы измерения по её коду (м², м, шт…) */
export const unitLabelOf = (value: string): string =>
  UNIT_OPTIONS.find((u) => u.value === value)?.label ?? value;
