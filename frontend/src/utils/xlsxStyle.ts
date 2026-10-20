// frontend/src/utils/xlsxStyle.ts
// ⭐ Общий «движок» оформления XLSX для выгрузок (сметы, склад): сетка, границы, шапка, форматы.
import * as XLSX from 'xlsx-js-style';

export const MONEY_FMT = '#,##0.00';
// ⚠️ Формат "#,##0.###" рисует «висячую» запятую у целых чисел (1 500,) — поэтому
// для целых количеств используем "#,##0", для дробных — "#,##0.###".
export const QTY_FMT_DEC = '#,##0.###';
export const QTY_FMT_INT = '#,##0';

const LINE = 'FFB0BEC5';
const FONT = { name: 'Calibri', sz: 11 };
const thin = { style: 'thin', color: { rgb: LINE } };
const BORDER = { top: thin, bottom: thin, left: thin, right: thin };

export type Style = Record<string, unknown>;

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
const qtyStyle = (fmt: string): Style => ({
  font: FONT, border: BORDER, numFmt: fmt,
  alignment: { horizontal: 'right', vertical: 'center' },
});
const moneyStyle = (fmt: string): Style => ({
  font: FONT, border: BORDER, numFmt: fmt,
  alignment: { horizontal: 'right', vertical: 'center' },
});
const S_QTY_INT = qtyStyle(QTY_FMT_INT);
const S_QTY_DEC = qtyStyle(QTY_FMT_DEC);
const S_MONEY = moneyStyle(MONEY_FMT);
const S_TOTAL_TEXT: Style = {
  font: { ...FONT, bold: true },
  fill: { patternType: 'solid', fgColor: { rgb: 'FFFFF9C4' } },
  border: BORDER,
  alignment: { vertical: 'center' },
};
const totalNum = (fmt: string): Style => ({
  ...S_TOTAL_TEXT, numFmt: fmt, alignment: { horizontal: 'right', vertical: 'center' },
});
const S_TOTAL_QTY_INT = totalNum(QTY_FMT_INT);
const S_TOTAL_QTY_DEC = totalNum(QTY_FMT_DEC);
const S_TOTAL_MONEY = totalNum(MONEY_FMT);

export type ColKind = 'text' | 'center' | 'qty' | 'money';

export interface SheetSpec {
  aoa: (string | number)[][];
  kinds: ColKind[];
  headerRows: number[];
  groupCells?: { r: number; c: number }[];
  totalRow?: number;
  metaRows?: number[];
  merges?: XLSX.Range[];
  headerHeight?: number;
}

const isInt = (v: unknown) => typeof v === 'number' && Number.isInteger(v);

// ⭐ Раскладывает значения по сетке и навешивает оформление (границы/шапка/форматы)
export const makeSheet = ({
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
        const int = isInt(cell.v);
        cell.s = isTotal ? (int ? S_TOTAL_QTY_INT : S_TOTAL_QTY_DEC) : (int ? S_QTY_INT : S_QTY_DEC);
        if (typeof cell.v === 'number') cell.z = int ? QTY_FMT_INT : QTY_FMT_DEC;
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
