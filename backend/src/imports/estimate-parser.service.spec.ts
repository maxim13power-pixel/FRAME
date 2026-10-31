// backend/src/imports/estimate-parser.service.spec.ts
// ⭐ №208: парсер должен читать НАШУ выгрузку («По спецификации», скрытый `_meta`)
// и внятно ругаться, если шапки нет.
import * as ExcelJS from 'exceljs';
import { BadRequestException } from '@nestjs/common';
import { EstimateParserService } from './estimate-parser.service';

const buildWorkbook = async (
  rows: (string | number)[][],
  meta?: [string, string | number][],
): Promise<Buffer> => {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Материалы');
  rows.forEach((r) => ws.addRow(r));
  if (meta) {
    const m = wb.addWorksheet('_meta');
    meta.forEach(([k, v]) => m.addRow([k, v]));
  }
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
};

describe('EstimateParserService (№208)', () => {
  const parser = new EstimateParserService();

  it('читает выгрузку FRAME: «По спецификации» → количество, «Цена» → цена', async () => {
    const buffer = await buildWorkbook(
      [
        ['Наименование', 'Артикул', 'Ед. изм.', 'По спецификации', 'Факт', 'Цена'],
        ['Кабель ВВГ 3х2.5', 'CAB-01', 'м', 350, 120, 95],
        ['ИТОГО:', '', '', 350, 120, ''],
      ],
      [
        ['frameExport', 1],
        ['columnsVersion', 1],
        ['projectId', 42],
        ['projectName', 'Дом на Ленина'],
      ],
    );

    const parsed = await parser.parseBuffer(buffer, 'materials-42.xlsx');

    expect(parsed.sheet).toBe('Материалы');
    expect(parsed.rows).toHaveLength(1); // «ИТОГО» пропущено
    expect(parsed.columns.qty).toBe(3);
    expect(parsed.columns.price).toBe(5);
    expect(parsed.rows[0]).toMatchObject({
      name: 'Кабель ВВГ 3х2.5',
      article: 'CAB-01',
      qtyRaw: '350',
      unitRaw: 'м',
      priceRaw: '95',
    });
    // ⭐ служебный лист прочитан — по нему определяем «свой» файл и чужой проект
    expect(parsed.meta).toMatchObject({ frameExport: 1, projectId: 42 });
  });

  it('файл без `_meta` (чужой или заполненный шаблон) читается по синонимам', async () => {
    const buffer = await buildWorkbook([
      ['Наименование работ', 'Ед.', 'Количество', 'Цена за единицу'],
      ['Штукатурка стен', 'м2', '25,5', '480'],
    ]);

    const parsed = await parser.parseBuffer(buffer, 'смета.xlsx');

    expect(parsed.meta).toBeNull();
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0].qtyRaw).toBe('25,5');
  });

  it('шаблон FRAME: две цены (работа + материал), повтор шапки не становится позицией', async () => {
    const buffer = await buildWorkbook([
      [
        'Наименование',
        'Артикул',
        'Ед. изм.',
        'Количество',
        'Цена работ за ед.',
        'Цена материала за ед.',
        'Примечание',
      ],
      // нижняя строка двухстрочной шапки (в нашей выгрузке там повтор подписей)
      [
        'Наименование',
        'Артикул',
        'Ед. изм.',
        'Количество',
        'Цена работ за ед.',
        'Цена материала за ед.',
        'Примечание',
      ],
      ['Укладка ламината', '', 'м2', 68, 280, 950, ''],
    ]);

    const parsed = await parser.parseBuffer(buffer, 'Шаблон сметы FRAME.xlsx');

    // ⭐ №211: строка-повтор шапки не должна превращаться в позицию «Наименование»
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.columns.price).toBe(4);
    expect(parsed.columns.priceMat).toBe(5);
    expect(parsed.rows[0]).toMatchObject({ priceRaw: '280', priceMatRaw: '950' });
  });

  it('без шапки с «Наименование» — понятная ошибка, а не мусор', async () => {
    const buffer = await buildWorkbook([
      ['что-то', 'иное'],
      ['ещё', 'строка'],
    ]);

    await expect(parser.parseBuffer(buffer, 'bad.xlsx')).rejects.toThrow(BadRequestException);
    await expect(parser.parseBuffer(buffer, 'bad.xlsx')).rejects.toThrow(/заголовк/i);
  });
});
