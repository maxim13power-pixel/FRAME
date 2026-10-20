// frontend/src/utils/exportWarehouse.ts
// ⭐ Выгрузка «Склада» в XLSX с тем же оформлением, что и «Сметы» (границы, шапка, форматы).
import * as XLSX from 'xlsx-js-style';
import { formatDateTime, fileDate, num } from './exportShared';
import { makeSheet, type ColKind } from './xlsxStyle';

export interface WarehouseExportItem {
  name: string;
  category?: string | null;
  quantity: number;
  unit: string;
  price?: number | null;
  object?: { name?: string | null } | null;
}

const COLS: { top: string; kind: ColKind; sum?: boolean }[] = [
  { top: 'Наименование', kind: 'text' },
  { top: 'Категория', kind: 'text' },
  { top: 'Остаток', kind: 'qty', sum: true },
  { top: 'Ед.', kind: 'center' },
  { top: 'Цена, руб.', kind: 'money' },
  { top: 'Сумма, руб.', kind: 'money', sum: true },
  { top: 'Объект', kind: 'text' },
];

export function exportWarehouseXlsx(items: WarehouseExportItem[]): void {
  const nCols = COLS.length;
  const now = new Date();

  const rows: (string | number)[][] = [
    ['Склад'],
    [`Дата выгрузки: ${formatDateTime(now)}`],
    [],
    COLS.map((c) => c.top),
    ...items.map((i) => [
      i.name,
      i.category ?? '',
      num(i.quantity),
      i.unit,
      i.price == null ? '' : num(i.price),
      i.price == null ? '' : num(i.price) * num(i.quantity),
      i.object?.name ?? '',
    ]),
  ];

  // ⭐ Итоговая строка: только там, где сумма имеет смысл (остаток и деньги, не «цена за ед.»)
  const totals: (string | number)[] = COLS.map((c, idx) => {
    if (idx === 0) return 'ИТОГО:';
    if (!c.sum) return '';
    let sum = 0;
    for (let r = 4; r < rows.length; r++) {
      const v = rows[r][idx];
      if (typeof v === 'number') sum += v;
    }
    return c.kind === 'money' ? Number(sum.toFixed(2)) : Number(sum.toFixed(3));
  });
  rows.push(totals);

  const ws = makeSheet({
    aoa: rows,
    kinds: COLS.map((c) => c.kind),
    headerRows: [3],
    totalRow: rows.length - 1,
    metaRows: [0, 1],
    merges: [
      { s: { r: 0, c: 0 }, e: { r: 0, c: nCols - 1 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: nCols - 1 } },
    ],
    headerHeight: 32,
  });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Склад');
  XLSX.writeFile(wb, `sklad-${fileDate(now)}.xlsx`, { cellStyles: true });
}
