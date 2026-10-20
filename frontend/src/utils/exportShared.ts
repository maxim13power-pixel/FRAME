// frontend/src/utils/exportShared.ts
// ⭐ Общие типы и форматирование для выгрузок раздела «Сметы» (XLSX и PDF).
export interface ExportMeta {
  objectName: string;
  projectName: string;
  exportedAt: Date;
  projectId: number | string;
}

const UNIT_LABELS: Record<string, string> = {
  PIECE: 'шт',
  METER: 'м',
  SQUARE_METER: 'м²',
  CUBIC_METER: 'м³',
  KILOGRAM: 'кг',
  LITER: 'л',
  TON: 'т',
  BAG: 'мешок',
  PACKAGE: 'упак',
  SET: 'компл',
};

export const unitLabel = (u: string) => UNIT_LABELS[u] ?? u;

export const pad = (n: number) => String(n).padStart(2, '0');

export const formatDateTime = (d: Date) =>
  `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;

export const fileDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const formatDateRu = (iso: string) => {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y.slice(2)}`;
};

export const money = (n: number) =>
  n.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const qty = (n: number) => Number(n.toFixed(3)).toLocaleString('ru-RU');

// ⭐ Приведение «строковых» Decimal с бэкенда к числу без NaN
export const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
