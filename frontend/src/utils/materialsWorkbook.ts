// frontend/src/utils/materialsWorkbook.ts
// ⭐ Сборка книги XLSX «Сметы»: лист «Материалы» + лист «Посменная сводка».
// Оформление (границы, шапка, форматы чисел) требует xlsx-js-style — форк SheetJS с записью стилей.
import * as XLSX from 'xlsx-js-style';
import type { MaterialData, MaterialFixData } from '../services/materialService';
import { formatDateRu, formatDateTime, num, unitLabel, type ExportMeta } from './exportShared';

const MONEY_FMT = '#,##0.00';
const QTY_FMT = '#,##0.###';
const LINE = 'FFB0BEC5';
const FONT = { name: 'Calibri', sz: 11 };

const thin = { style: 'thin', color: { rgb: LINE } };
const BORDER = { top: thin, bottom: thin, left: thin, right: thin };

type Style = Record<string, unknown>;

const S_TITLE: Style = { font: { ...FONT, bold: true, sz: 12, color: { rgb: 'FF04164B' } } };
const S_META: Style = { font: { ...FONT, color: { rgb: 'FF37474F' } } };
const S_HEAD: Style = {
  font: { ...FONT, bold: true, color: { rgb: 'FF04164B' } },
  fill: { patternType: 'solid', fgColor: { rgb: 'FFE3F2FD' } },
  border: BORDER,
  alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
};
const S_GROUP: Style = { ...S_HEAD, fill: { patternType: 'solid', fgColor: { rgb: 'FFBBDEFB' } } };
const S_TEXT: Style = { font: FONT, border: BORDER, alignment: { vertical: 'center', wrapText: true } };
const S_CENTER: Style = { ...S_TEXT, alignment: { horizontal: 'center', vertical: 'center' } };
const S_QTY: Style = {
  font: FONT, border: BORDER, numFmt: QTY_FMT,
  alignment: { horizontal: 'right', vertical: 'center' },
};
const S_MONEY: Style = {
  font: FONT, border: BORDER, numFmt: MONEY_FMT,
  alignment: { horizontal: 'right', vertical: 'center' },
};
const S_TOTAL_TEXT: Style = {
  font: { ...FONT, bold: true },
  fill: { patternType: 'solid', fgColor: { rgb: 'FFFFF9C4' } },
  border: BORDER,
  alignment: { vertical: 'center' },
};
const S_TOTAL_QTY: Style = {
  ...S_TOTAL_TEXT, numFmt: QTY_FMT, alignment: { horizontal: 'right', vertical: 'center' },
};
const S_TOTAL_MONEY: Style = {
  ...S_TOTAL_TEXT, numFmt: MONEY_FMT, alignment: { horizontal: 'right', vertical: 'center' },
};

type ColKind = 'text' | 'center' | 'qty' | 'money';

interface Col {
  top: string;
  sub?: string;
  kind: ColKind;
}

// ⭐ Колонки листа «Материалы» — 1:1 с таблицей раздела (включая стоимость по смете)
const buildCols = (includePrices: boolean): Col[] => {
  const cols: Col[] = [
    { top: 'Наименование', kind: 'text' },
    { top: 'Артикул', kind: 'center' },
    { top: 'Ед. изм.', kind: 'center' },
    { top: 'По спецификации', kind: 'qty' },
    { top: 'Факт', kind: 'qty' },
    { top: 'Прогресс, %', kind: 'center' },
  ];
  if (includePrices) {
    cols.push(
      { top: 'Работ на тек. момент, руб.', kind: 'money' },
      { top: 'Материал на тек. момент, руб.', kind: 'money' },
      { top: 'Итого на тек. момент, руб.', kind: 'money' },
      { top: 'Стоимость работ по смете (руб.)', sub: 'За ед.', kind: 'money' },
      { top: 'Стоимость работ по смете (руб.)', sub: 'Итого руб.', kind: 'money' },
      { top: 'Стоимость материалов по смете (руб.)', sub: 'За ед.', kind: 'money' },
      { top: 'Стоимость материалов по смете (руб.)', sub: 'Итого руб.', kind: 'money' },
      { top: 'Итого по смете, руб.', kind: 'money' },
    );
  }
  cols.push({ top: 'Примечание', kind: 'text' });
  return cols;
};

interface MoneyRow {
  workCurrent: number;
  matCurrent: number;
  totalCurrent: number;
  workUnit: number;
  workEstimate: number;
  matUnit: number;
  matEstimate: number;
  estimate: number;
}

const moneyRow = (m: MaterialData): MoneyRow => {
  const q = num(m.specQuantity);
  const workUnit = num(m.unitPrice);
  const matUnit = num(m.materialUnitPrice);
  return {
    workCurrent: num(m.totalCost),
    matCurrent: num(m.materialTotalCost),
    totalCurrent: num(m.totalCost) + num(m.materialTotalCost),
    workUnit,
    workEstimate: workUnit * q,
    matUnit,
    matEstimate: matUnit * q,
    estimate: (workUnit + matUnit) * q,
  };
};

const rowValues = (m: MaterialData, includePrices: boolean): (string | number)[] => {
  const row: (string | number)[] = [
    m.name,
    m.article ?? '',
    unitLabel(m.unit),
    num(m.specQuantity),
    num(m.totalUsed),
    `${m.progressPercent}%`,
  ];
  if (includePrices) {
    const r = moneyRow(m);
    row.push(
      r.workCurrent, r.matCurrent, r.totalCurrent,
      r.workUnit, r.workEstimate,
      r.matUnit, r.matEstimate,
      r.estimate,
    );
  }
  row.push(m.note ?? '');
  return row;
};

const round3 = (n: number) => Number(n.toFixed(3));

const totalRowValues = (materials: MaterialData[], includePrices: boolean): (string | number)[] => {
  const row: (string | number)[] = [
    'ИТОГО:',
    '',
    '',
    round3(materials.reduce((s, m) => s + num(m.specQuantity), 0)),
    round3(materials.reduce((s, m) => s + num(m.totalUsed), 0)),
    '',
  ];
  if (includePrices) {
    const agg = { workCurrent: 0, matCurrent: 0, totalCurrent: 0, workEstimate: 0, matEstimate: 0, estimate: 0 };
    for (const m of materials) {
      const r = moneyRow(m);
      agg.workCurrent += r.workCurrent;
      agg.matCurrent += r.matCurrent;
      agg.totalCurrent += r.totalCurrent;
      agg.workEstimate += r.workEstimate;
      agg.matEstimate += r.matEstimate;
      agg.estimate += r.estimate;
    }
    row.push(
      agg.workCurrent, agg.matCurrent, agg.totalCurrent,
      '', agg.workEstimate,
      '', agg.matEstimate,
      agg.estimate,
    );
  }
  row.push('');
  return row;
};


interface SheetSpec {
  aoa: (string | number)[][];
  kinds: ColKind[];
  headerRows: number[];
  groupCells?: { r: number; c: number }[];
  totalRow?: number;
  metaRows?: number[];
  merges?: XLSX.Range[];
  headerHeight?: number;
}

// ⭐ Раскладывает значения по сетке и навешивает оформление (границы/шапка/форматы)
const makeSheet = ({
  aoa, kinds, headerRows, groupCells = [], totalRow, metaRows = [], merges = [], headerHeight = 32,
}: SheetSpec): XLSX.WorkSheet => {
  const nCols = kinds.length;
  const lastRow = aoa.length - 1;
  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Пустые ячейки тоже должны существовать — иначе Excel не нарисует у них рамку
  for (let r = 0; r <= lastRow; r++) {
    for (let c = 0; c < nCols; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      if (!ws[addr]) ws[addr] = { t: 's', v: '' };
    }
  }
  ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: lastRow, c: nCols - 1 } });
  ws['!merges'] = merges;

  const metaSet = new Set(metaRows);
  const headerSet = new Set(headerRows);
  const groupSet = new Set(groupCells.map((g) => `${g.r}:${g.c}`));
  const blankRow = (r: number) => aoa[r].every((v) => v === '' || v === null || v === undefined);

  for (let r = 0; r <= lastRow; r++) {
    if (metaSet.has(r)) {
      // Текст шапки-описания живёт в A{row}, остальное объединено и остаётся без рамок
      const cell = ws[XLSX.utils.encode_cell({ r, c: 0 })] as XLSX.CellObject;
      cell.s = r === metaRows[0] ? S_TITLE : S_META;
      continue;
    }
    if (blankRow(r)) continue; // строка-разделитель: без рамок и заливки
    for (let c = 0; c < nCols; c++) {
      const cell = ws[XLSX.utils.encode_cell({ r, c })] as XLSX.CellObject;
      const kind = kinds[c];
      if (headerSet.has(r)) {
        cell.s = groupSet.has(`${r}:${c}`) ? S_GROUP : S_HEAD;
        continue;
      }
      const isTotal = totalRow === r;
      if (kind === 'money') {
        cell.s = isTotal ? S_TOTAL_MONEY : S_MONEY;
        if (typeof cell.v === 'number') cell.z = MONEY_FMT;
      } else if (kind === 'qty') {
        cell.s = isTotal ? S_TOTAL_QTY : S_QTY;
        if (typeof cell.v === 'number') cell.z = QTY_FMT;
      } else if (kind === 'center') {
        cell.s = isTotal ? S_TOTAL_TEXT : S_CENTER;
      } else {
        cell.s = isTotal ? S_TOTAL_TEXT : S_TEXT;
      }
    }
  }

  // Ширина колонок по фактическому содержимому (кириллица ~2 знака)
  ws['!cols'] = kinds.map((kind, c) => {
    let len = 0;
    for (let r = 0; r <= lastRow; r++) {
      const v = aoa[r]?.[c];
      if (typeof v === 'string') len = Math.max(len, v.replace(/[^\x20-\x7E]/g, '  ').length);
    }
    const min = kind === 'money' ? 14 : kind === 'qty' ? 10 : kind === 'center' ? 10 : 14;
    return { wch: Math.min(46, Math.max(min, len + 2)) };
  });

  ws['!rows'] = Array.from({ length: lastRow + 1 }, (_v, r) => {
    if (metaSet.has(r)) return { hpt: 18 };
    if (blankRow(r)) return { hpt: 8 };
    if (headerSet.has(r)) return { hpt: headerHeight };
    return {};
  });

  return ws;
};


// ---------- Лист «Материалы» ----------
const buildMaterialsSheet = (
  materials: MaterialData[],
  meta: ExportMeta,
  includePrices: boolean,
): XLSX.WorkSheet => {
  const cols = buildCols(includePrices);
  const nCols = cols.length;

  const aoa: (string | number)[][] = [
    [`Смета по объекту: ${meta.objectName}`],
    [`Проект: ${meta.projectName}`],
    [`Дата выгрузки: ${formatDateTime(meta.exportedAt)}`],
    [],
    cols.map((c) => c.top),
    cols.map((c) => c.sub ?? ''),
    ...materials.map((m) => rowValues(m, includePrices)),
  ];
  if (includePrices) aoa.push(totalRowValues(materials, includePrices));

  const rows = aoa.map((row) => {
    const r = [...row];
    while (r.length < nCols) r.push('');
    return r;
  });

  const merges: XLSX.Range[] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: nCols - 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: nCols - 1 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: nCols - 1 } },
  ];
  const groupCells: { r: number; c: number }[] = [];
  let c = 0;
  while (c < nCols) {
    if (cols[c].sub) {
      let c2 = c;
      while (c2 + 1 < nCols && cols[c2 + 1].sub && cols[c2 + 1].top === cols[c].top) c2++;
      if (c2 > c) {
        merges.push({ s: { r: 4, c }, e: { r: 4, c: c2 } });
        for (let i = c; i <= c2; i++) groupCells.push({ r: 4, c: i });
      }
      c = c2 + 1;
    } else {
      merges.push({ s: { r: 4, c }, e: { r: 5, c } });
      c++;
    }
  }

  return makeSheet({
    aoa: rows,
    kinds: cols.map((col) => col.kind),
    headerRows: [4, 5],
    groupCells,
    totalRow: includePrices ? rows.length - 1 : undefined,
    metaRows: [0, 1, 2],
    merges,
    headerHeight: 34,
  });
};

// ---------- Лист «Посменная сводка» ----------
const buildShiftSheet = (
  materials: MaterialData[],
  meta: ExportMeta,
  includePrices: boolean,
  fixes: Record<number, MaterialFixData[]>,
): XLSX.WorkSheet => {
  const dateSet = new Set<string>();
  for (const m of materials) {
    for (const f of fixes[m.id] ?? []) dateSet.add(String(f.fixedAt).slice(0, 10));
  }
  const dates = Array.from(dateSet).sort();

  const kinds: ColKind[] = ['text', 'center', 'center', 'qty', 'qty'];
  const headers = ['Наименование', 'Артикул', 'Ед. изм.', 'По спецификации', 'Факт'];
  if (includePrices) {
    kinds.push('money', 'money', 'money');
    headers.push(
      'Работ на тек. момент, руб.',
      'Материал на тек. момент, руб.',
      'Итого на тек. момент, руб.',
    );
  }
  for (const d of dates) {
    kinds.push('qty', 'text');
    headers.push(formatDateRu(d), 'Примечание');
  }
  const nCols = kinds.length;

  const aoa: (string | number)[][] = [
    [`Посменная сводка по объекту: ${meta.objectName}`],
    [`Проект: ${meta.projectName}`],
    [`Дата выгрузки: ${formatDateTime(meta.exportedAt)}`],
    [],
    headers,
  ];

  for (const m of materials) {
    const row: (string | number)[] = [
      m.name,
      m.article ?? '',
      unitLabel(m.unit),
      num(m.specQuantity),
      num(m.totalUsed),
    ];
    if (includePrices) {
      row.push(
        num(m.totalCost),
        num(m.materialTotalCost),
        num(m.totalCost) + num(m.materialTotalCost),
      );
    }

    const byDate = new Map<string, { amount: number; notes: string[] }>();
    for (const f of fixes[m.id] ?? []) {
      const d = String(f.fixedAt).slice(0, 10);
      if (!byDate.has(d)) byDate.set(d, { amount: 0, notes: [] });
      const e = byDate.get(d)!;
      e.amount += num(f.amount);
      if (f.note) e.notes.push(f.note);
    }

    for (const d of dates) {
      const e = byDate.get(d);
      row.push(e ? round3(e.amount) : '', e ? e.notes.join('; ') : '');
    }
    aoa.push(row);
  }

  const rows = aoa.map((row) => {
    const r = [...row];
    while (r.length < nCols) r.push('');
    return r;
  });

  return makeSheet({
    aoa: rows,
    kinds,
    headerRows: [4],
    metaRows: [0, 1, 2],
    merges: [
      { s: { r: 0, c: 0 }, e: { r: 0, c: nCols - 1 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: nCols - 1 } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: nCols - 1 } },
    ],
    headerHeight: 34,
  });
};

// ⭐ Публичная точка входа: готовая книга с двумя листами
export const buildMaterialsWorkbook = (
  materials: MaterialData[],
  meta: ExportMeta,
  includePrices: boolean,
  fixes?: Record<number, MaterialFixData[]>,
): XLSX.WorkBook => {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, buildMaterialsSheet(materials, meta, includePrices), 'Материалы');
  if (fixes) {
    XLSX.utils.book_append_sheet(
      wb,
      buildShiftSheet(materials, meta, includePrices, fixes),
      'Посменная сводка',
    );
  }
  return wb;
};
