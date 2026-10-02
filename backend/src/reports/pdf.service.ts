// backend/src/reports/pdf.service.ts
// ⭐ №122b: экспорт отчёта в PDF (pdfmake 0.3 + Roboto, кириллица из коробки).
import { Injectable } from '@nestjs/common';
import type { TDocumentDefinitions } from 'pdfmake/interfaces';

// ⭐ pdfmake 0.3.x: require('pdfmake') возвращает СИНГЛЕТОН (не класс Printer).
// Шрифты: кладём VFS-файлы в virtualfs, затем setFonts с дескрипторами имён.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfmake = require('pdfmake');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfVfs = require('pdfmake/build/vfs_fonts.js');

const vfs = pdfmake.virtualfs;
for (const [name, b64] of Object.entries(pdfVfs)) {
  vfs.writeFileSync(name, Buffer.from(b64 as string, 'base64'));
}

pdfmake.setFonts({
  Roboto: {
    normal: 'Roboto-Regular.ttf',
    bold: 'Roboto-Medium.ttf',
    italics: 'Roboto-Italic.ttf',
    bolditalics: 'Roboto-MediumItalic.ttf',
  },
});

// ⭐ Безопасность: запрещаем внешние URL и доступ к локальной ФС
pdfmake.setUrlAccessPolicy(() => false);
pdfmake.setLocalAccessPolicy(() => false);

const TYPE_LABELS: Record<string, string> = {
  estimate: 'Смета',
  act: 'Акт выполненных работ',
};
const STATUS_LABELS: Record<string, string> = {
  draft: 'Черновик',
  sent: 'Отправлен',
  approved: 'Утверждён',
  rejected: 'Отклонён',
};

const fmt = (v: unknown) => {
  const n = Number(String(v ?? 0));
  return (Number.isFinite(n) ? n : 0).toLocaleString('ru-RU', {
    maximumFractionDigits: 2,
  });
};

interface ReportLike {
  type: string;
  title: string;
  status: string;
  totalAmount: unknown;
  createdAt: string | Date;
  object?: { name: string } | null;
  project?: { name: string } | null;
}

interface ItemLike {
  name: string;
  unit: string;
  quantity: unknown;
  price: unknown;
  total: unknown;
}

@Injectable()
export class ReportPdfService {
  async generate(report: ReportLike, items: ItemLike[]): Promise<Buffer> {
    const docDefinition: TDocumentDefinitions = {
      defaultStyle: { font: 'Roboto', fontSize: 10 },
      content: [
        {
          text: `${TYPE_LABELS[report.type] || report.type} — ${report.title}`,
          style: 'header',
        },
        {
          text: `${report.object?.name || ''} • ${report.project?.name || ''}`,
          style: 'subheader',
        },
        {
          text: `Статус: ${STATUS_LABELS[report.status] || report.status} • Создан: ${new Date(
            report.createdAt,
          ).toLocaleDateString('ru-RU')}`,
          style: 'small',
        },
        {
          table: {
            headerRows: 1,
            widths: ['auto', '*', 'auto', 'auto', 'auto', 'auto'],
            body: [
              [
                { text: '№', style: 'tableHeader' },
                { text: 'Название', style: 'tableHeader' },
                { text: 'Ед.', style: 'tableHeader' },
                { text: 'Кол-во', style: 'tableHeader' },
                { text: 'Цена', style: 'tableHeader' },
                { text: 'Сумма', style: 'tableHeader' },
              ],
              ...items.map((it, i) => [
                String(i + 1),
                it.name,
                it.unit,
                fmt(it.quantity),
                fmt(it.price),
                fmt(it.total),
              ]),
            ],
          },
          layout: 'lightHorizontalLines',
        },
        {
          text: `Итого: ${fmt(report.totalAmount)} ₽`,
          style: 'total',
          alignment: 'right',
        },
      ],
      styles: {
        header: { fontSize: 16, bold: true, margin: [0, 0, 0, 4] },
        subheader: { fontSize: 11, color: '#555555', margin: [0, 0, 0, 2] },
        small: { fontSize: 9, color: '#888888', margin: [0, 0, 0, 10] },
        tableHeader: { bold: true, fillColor: '#e3f2fd' },
        total: { fontSize: 13, bold: true, margin: [0, 10, 0, 0] },
      },
    };

    const doc = pdfmake.createPdf(docDefinition);
    return (await doc.getBuffer()) as Buffer;
  }
}
