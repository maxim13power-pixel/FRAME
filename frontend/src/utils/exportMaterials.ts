// frontend/src/utils/exportMaterials.ts
// ⭐ Экспорт материалов проекта в XLSX и PDF (клиентская генерация, бэкенд не трогаем).
import * as XLSX from 'xlsx';
// pdfmake 0.3.x не поставляет .d.ts для build/pdfmake и build/vfs_fonts — глушим TS7016.
// @ts-ignore
import pdfMake from 'pdfmake/build/pdfmake';
// @ts-ignore
import pdfFonts from 'pdfmake/build/vfs_fonts';
import type { MaterialData } from '../services/materialService';

// ⭐ vfs (Roboto с кириллицей). pdfmake отдаёт vfs в двух формах — берём ту, что есть.
pdfMake.vfs = pdfFonts.pdfMake?.vfs ?? pdfFonts.vfs;

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

const unitLabel = (u: string) => UNIT_LABELS[u] ?? u;

const pad = (n: number) => String(n).padStart(2, '0');

const formatDateTime = (d: Date) =>
  `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;

const fileDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const money = (n: number) =>
  n.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const qty = (n: number) => Number(n.toFixed(3)).toLocaleString('ru-RU');

// Заголовки (без трёх ценовых колонок при includePrices=false)
const buildHeaders = (includePrices: boolean): string[] => {
  const headers = ['Название', 'Артикул', 'Ед.изм.', 'По спецификации', 'Факт', 'Прогресс %'];
  if (includePrices) {
    headers.push('Работ на тек. момент', 'Материал на тек. момент', 'Итого на тек. момент');
  }
  headers.push('Примечание');
  return headers;
};

// Ячейки строки для XLSX (числа остаются числами)
const rowCore = (m: MaterialData, includePrices: boolean): (string | number)[] => {
  const row: (string | number)[] = [
    m.name,
    m.article ?? '',
    unitLabel(m.unit),
    m.specQuantity,
    m.totalUsed,
    `${m.progressPercent}%`,
  ];
  if (includePrices) {
    row.push(m.totalCost, m.materialTotalCost, m.totalCost + m.materialTotalCost);
  }
  row.push(m.note ?? '');
  return row;
};

export function exportMaterialsXlsx(
  materials: MaterialData[],
  meta: ExportMeta,
  includePrices: boolean,
): void {
  const headers = buildHeaders(includePrices);
  const aoa: (string | number)[][] = [
    [`Объект: ${meta.objectName}`],
    [`Проект: ${meta.projectName}`],
    [`Дата выгрузки: ${formatDateTime(meta.exportedAt)}`],
    [],
    headers,
    ...materials.map((m) => rowCore(m, includePrices)),
  ];

  if (includePrices) {
    const sumWork = materials.reduce((s, m) => s + m.totalCost, 0);
    const sumMat = materials.reduce((s, m) => s + m.materialTotalCost, 0);
    aoa.push(['Итого', '', '', '', '', '', sumWork, sumMat, sumWork + sumMat, '']);
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = headers.map((h) => ({ wch: Math.max(14, h.length + 4) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Материалы');
  XLSX.writeFile(wb, `materials-${meta.projectId}-${fileDate(meta.exportedAt)}.xlsx`);
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
