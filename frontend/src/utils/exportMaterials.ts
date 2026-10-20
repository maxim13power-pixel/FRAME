// frontend/src/utils/exportMaterials.ts
// ⭐ Экспорт материалов проекта в XLSX и PDF (клиентская генерация, бэкенд не трогаем).
// XLSX собирается через xlsx-js-style (форк SheetJS, умеет писать границы/заливки/форматы).
import * as XLSX from 'xlsx-js-style';
// pdfmake 0.3.x не поставляет .d.ts для build/pdfmake и build/vfs_fonts — ожидаем ошибку типов.
// @ts-expect-error TS7016: нет деклараций для модуля
import pdfMake from 'pdfmake/build/pdfmake';
// @ts-expect-error TS7016: нет деклараций для модуля
import pdfFonts from 'pdfmake/build/vfs_fonts';
import type { MaterialData, MaterialFixData } from '../services/materialService';
import { fileDate, formatDateTime, money, num, qty, unitLabel, type ExportMeta } from './exportShared';
import { buildMaterialsWorkbook } from './materialsWorkbook';
import type { ColKind } from './xlsxStyle';

// ⭐ ExportMeta живёт в exportShared — реэкспорт, чтобы не менять импорты в страницах.
export type { ExportMeta };

// ⭐ vfs (Roboto с кириллицей). pdfmake отдаёт vfs в двух формах — берём ту, что есть.
pdfMake.vfs = pdfFonts.pdfMake?.vfs ?? pdfFonts.vfs;

// Колонки PDF-выгрузки: короткие двухстрочные заголовки — 15 колонок влезают в landscape
type PdfCell = { text?: string; bold?: boolean; fontSize?: number; colSpan?: number; alignment?: string };

const pdfCols = (includePrices: boolean): { label: string; kind: ColKind }[] => {
  const cols: { label: string; kind: ColKind }[] = [
    { label: 'Название', kind: 'text' },
    { label: 'Артикул', kind: 'center' },
    { label: 'Ед.изм.', kind: 'center' },
    { label: 'По спец.', kind: 'qty' },
    { label: 'Факт', kind: 'qty' },
    { label: '%', kind: 'center' },
  ];
  if (includePrices) {
    cols.push(
      { label: 'Работ\nтек.', kind: 'money' },
      { label: 'Мат.\nтек.', kind: 'money' },
      { label: 'Итого\nтек.', kind: 'money' },
      { label: 'Работ\nза ед.', kind: 'money' },
      { label: 'Работ\nитого', kind: 'money' },
      { label: 'Мат.\nза ед.', kind: 'money' },
      { label: 'Мат.\nитого', kind: 'money' },
      { label: 'Итого\nсмета', kind: 'money' },
    );
  }
  cols.push({ label: 'Примечание', kind: 'text' });
  return cols;
};

const pdfAlign = (kind: ColKind): string =>
  kind === 'money' || kind === 'qty' ? 'right' : kind === 'center' ? 'center' : 'left';

export function exportMaterialsXlsx(
  materials: MaterialData[],
  meta: ExportMeta,
  includePrices: boolean,
  fixes?: Record<number, MaterialFixData[]>,
): void {
  // ⭐ Сборка книги (оба листа + оформление) — в materialsWorkbook.ts
  const wb = buildMaterialsWorkbook(materials, meta, includePrices, fixes);
  XLSX.writeFile(wb, `materials-${meta.projectId}-${fileDate(meta.exportedAt)}.xlsx`, {
    cellStyles: true,
  });
}

export function exportMaterialsPdf(
  materials: MaterialData[],
  meta: ExportMeta,
  includePrices: boolean,
): void {
  const cols = pdfCols(includePrices);
  const body: PdfCell[][] = [
    cols.map((c) => ({
      text: c.label,
      bold: true,
      fontSize: 7,
      alignment: 'center',
    })),
  ];

  for (const m of materials) {
    const cells: string[] = [
      m.name,
      m.article ?? '',
      unitLabel(m.unit),
      qty(m.specQuantity),
      qty(m.totalUsed),
      `${m.progressPercent}%`,
    ];
    if (includePrices) {
      const q = num(m.specQuantity);
      const workUnit = num(m.unitPrice);
      const matUnit = num(m.materialUnitPrice);
      cells.push(
        money(m.totalCost),
        money(m.materialTotalCost),
        money(m.totalCost + m.materialTotalCost),
        money(workUnit),
        money(workUnit * q),
        money(matUnit),
        money(matUnit * q),
        money((workUnit + matUnit) * q),
      );
    }
    cells.push(m.note ?? '');
    body.push(cells.map((cell, i) => ({ text: cell, fontSize: 7, alignment: pdfAlign(cols[i].kind) })));
  }

  if (includePrices) {
    const agg = materials.reduce(
      (a, m) => {
        const q = num(m.specQuantity);
        const workUnit = num(m.unitPrice);
        const matUnit = num(m.materialUnitPrice);
        a.workCurrent += num(m.totalCost);
        a.matCurrent += num(m.materialTotalCost);
        a.totalCurrent += num(m.totalCost) + num(m.materialTotalCost);
        a.workEstimate += workUnit * q;
        a.matEstimate += matUnit * q;
        a.estimate += (workUnit + matUnit) * q;
        return a;
      },
      { workCurrent: 0, matCurrent: 0, totalCurrent: 0, workEstimate: 0, matEstimate: 0, estimate: 0 },
    );

    body.push([
      { text: 'Итого', bold: true, fontSize: 7, colSpan: 6 },
      {}, {}, {}, {}, {},
      { text: money(agg.workCurrent), bold: true, fontSize: 7, alignment: 'right' },
      { text: money(agg.matCurrent), bold: true, fontSize: 7, alignment: 'right' },
      { text: money(agg.totalCurrent), bold: true, fontSize: 7, alignment: 'right' },
      { text: '', fontSize: 7 },
      { text: money(agg.workEstimate), bold: true, fontSize: 7, alignment: 'right' },
      { text: '', fontSize: 7 },
      { text: money(agg.matEstimate), bold: true, fontSize: 7, alignment: 'right' },
      { text: money(agg.estimate), bold: true, fontSize: 7, alignment: 'right' },
      { text: '', fontSize: 7 },
    ]);
  }

  const widths = cols.map((_c, i) => (i === 0 ? '*' : 44));

  const docDefinition = {
    pageOrientation: 'landscape',
    pageMargins: [16, 16, 16, 16],
    content: [
      { text: meta.objectName, bold: true, fontSize: 13, margin: [0, 0, 0, 2] },
      { text: meta.projectName, fontSize: 11, margin: [0, 0, 0, 2] },
      {
        text: `Дата выгрузки: ${formatDateTime(meta.exportedAt)}`,
        fontSize: 9,
        color: '#616161',
        margin: [0, 0, 0, 8],
      },
      {
        table: { headerRows: 1, widths, body },
        layout: {
          hLineWidth: () => 0.5,
          vLineWidth: () => 0.5,
          hLineColor: () => '#B0BEC5',
          vLineColor: () => '#B0BEC5',
          paddingLeft: () => 2,
          paddingRight: () => 2,
          paddingTop: () => 2,
          paddingBottom: () => 2,
        },
      },
    ],
  };

  pdfMake.createPdf(docDefinition).download(
    `materials-${meta.projectId}-${fileDate(meta.exportedAt)}.pdf`,
  );
}
