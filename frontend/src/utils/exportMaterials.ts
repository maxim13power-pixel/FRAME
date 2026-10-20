// frontend/src/utils/exportMaterials.ts
// ⭐ Экспорт материалов проекта в XLSX и PDF (клиентская генерация, бэкенд не трогаем).
// XLSX собирается через xlsx-js-style (форк SheetJS, умеет писать границы/заливки/форматы).
import * as XLSX from 'xlsx-js-style';
// pdfmake 0.3.x не поставляет .d.ts для build/pdfmake и build/vfs_fonts — глушим TS7016.
// @ts-ignore
import pdfMake from 'pdfmake/build/pdfmake';
// @ts-ignore
import pdfFonts from 'pdfmake/build/vfs_fonts';
import type { MaterialData, MaterialFixData } from '../services/materialService';
import { fileDate, formatDateTime, money, qty, unitLabel, type ExportMeta } from './exportShared';
import { buildMaterialsWorkbook } from './materialsWorkbook';

// ⭐ ExportMeta живёт в exportShared — реэкспорт, чтобы не менять импорты в страницах.
export type { ExportMeta };

// ⭐ vfs (Roboto с кириллицей). pdfmake отдаёт vfs в двух формах — берём ту, что есть.
pdfMake.vfs = pdfFonts.pdfMake?.vfs ?? pdfFonts.vfs;

// Заголовки PDF-выгрузки (без трёх ценовых колонок при includePrices=false)
const buildHeaders = (includePrices: boolean): string[] => {
  const headers = ['Название', 'Артикул', 'Ед.изм.', 'По спецификации', 'Факт', 'Прогресс %'];
  if (includePrices) {
    headers.push('Работ на тек. момент', 'Материал на тек. момент', 'Итого на тек. момент');
  }
  headers.push('Примечание');
  return headers;
};

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
  const headers = buildHeaders(includePrices);
  const body: any[][] = [headers.map((h) => ({ text: h, bold: true, fontSize: 9 }))];

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
      cells.push(
        money(m.totalCost),
        money(m.materialTotalCost),
        money(m.totalCost + m.materialTotalCost),
      );
    }
    cells.push(m.note ?? '');
    body.push(cells.map((cell) => ({ text: cell, fontSize: 8 })));
  }

  if (includePrices) {
    const sumWork = materials.reduce((s, m) => s + m.totalCost, 0);
    const sumMat = materials.reduce((s, m) => s + m.materialTotalCost, 0);
    body.push([
      { text: 'Итого', bold: true, fontSize: 9, colSpan: 6 },
      {}, {}, {}, {}, {},
      { text: money(sumWork), bold: true, fontSize: 8 },
      { text: money(sumMat), bold: true, fontSize: 8 },
      { text: money(sumWork + sumMat), bold: true, fontSize: 8 },
      { text: '', fontSize: 8 },
    ]);
  }

  const widths = headers.map((_h, i) => (i === 0 ? '*' : 'auto'));

  const docDefinition = {
    pageOrientation: 'landscape',
    pageMargins: [24, 24, 24, 24],
    content: [
      { text: meta.objectName, bold: true, fontSize: 14, margin: [0, 0, 0, 2] },
      { text: meta.projectName, fontSize: 12, margin: [0, 0, 0, 2] },
      {
        text: `Дата выгрузки: ${formatDateTime(meta.exportedAt)}`,
        fontSize: 10,
        color: '#616161',
        margin: [0, 0, 0, 10],
      },
      {
        table: { headerRows: 1, widths, body },
        layout: 'lightHorizontalLines',
      },
    ],
  };

  pdfMake.createPdf(docDefinition).download(
    `materials-${meta.projectId}-${fileDate(meta.exportedAt)}.pdf`,
  );
}
