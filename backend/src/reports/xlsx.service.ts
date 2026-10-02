// backend/src/reports/xlsx.service.ts
// ⭐ №122b: экспорт отчёта в XLSX (exceljs).
import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';

interface ReportLike {
  type: string;
  title: string;
  totalAmount: unknown;
}

interface ItemLike {
  name: string;
  unit: string;
  quantity: unknown;
  price: unknown;
  total: unknown;
}

const num = (v: unknown) => {
  const n = Number(String(v ?? 0));
  return Number.isFinite(n) ? n : 0;
};

@Injectable()
export class ReportXlsxService {
  async generate(report: ReportLike, items: ItemLike[]): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Отчёт');

    sheet.columns = [
      { header: '№', key: 'n', width: 6 },
      { header: 'Название', key: 'name', width: 44 },
      { header: 'Ед. изм.', key: 'unit', width: 10 },
      { header: 'Количество', key: 'qty', width: 12 },
      { header: 'Цена', key: 'price', width: 12 },
      { header: 'Сумма', key: 'total', width: 14 },
    ];

    // Заголовок
    sheet.addRow([`${report.type === 'act' ? 'Акт' : 'Смета'}: ${report.title}`]);
    sheet.mergeCells(1, 1, 1, 6);
    sheet.getRow(1).font = { bold: true, size: 14 };
    sheet.addRow([]);

    items.forEach((it, i) => {
      sheet.addRow({
        n: i + 1,
        name: it.name,
        unit: it.unit,
        qty: num(it.quantity),
        price: num(it.price),
        total: num(it.total),
      });
    });

    sheet.addRow({});
    const totalRow = sheet.addRow({ name: 'ИТОГО', total: num(report.totalAmount) });
    totalRow.font = { bold: true };

    const data = await workbook.xlsx.writeBuffer();
    return Buffer.from(data as ArrayBuffer);
  }
}
