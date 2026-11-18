// backend/src/price-list-import/price-template.service.spec.ts
import { PriceKind, Unit } from '@prisma/client';
import * as ExcelJS from 'exceljs';
import { PriceTemplateService } from './price-template.service';

describe('PriceTemplateService — шаблон и разбор (§121)', () => {
  const service = new PriceTemplateService();

  it('собирает шаблон и читает его обратно (ID, цены, единицы, категории)', async () => {
    const buffer = await service.build({
      catalogId: 42,
      catalogName: 'Мой справочник',
      kind: PriceKind.WORK,
      sheets: [
        {
          sheet: 'Электромонтаж',
          category: 'Электромонтаж',
          items: [
            { id: 501, name: 'Установка розетки', article: 'ETM-1', unit: Unit.PIECE, price: 350 },
            { id: 502, name: 'Штробление', article: null, unit: Unit.LINEAR_METER, price: 120.5 },
          ],
        },
        { sheet: 'Плиточные', category: 'Плиточные работы', items: [] },
      ],
    });
    expect(buffer.length).toBeGreaterThan(0);

    const parsed = await service.parse(buffer);
    expect(parsed.template).toBe(true);
    expect(parsed.kind).toBe('WORK');
    expect(parsed.catalogId).toBe(42);
    expect(parsed.sheets.map((s) => s.sheet)).toEqual(['Электромонтаж', 'Плиточные']);
    expect(parsed.sheets[1].category).toBe('Плиточные работы');
    expect(parsed.sheets[1].rows).toHaveLength(0);

    const rows = parsed.sheets[0].rows;
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      id: 501,
      name: 'Установка розетки',
      article: 'ETM-1',
      price: 350,
      unitRaw: 'шт',
    });
    expect(rows[1]).toMatchObject({ id: 502, unitRaw: 'пог. м', price: 120.5 });
  });

  it('листы идут в порядке: «Как заполнять», «Единицы», потом категории (№289)', async () => {
    const buffer = await service.build({
      catalogId: 42,
      catalogName: 'Мой справочник',
      kind: PriceKind.WORK,
      sheets: [
        { sheet: 'Электромонтаж', category: 'Электромонтаж', items: [] },
        { sheet: 'Плиточные', category: 'Плиточные работы', items: [] },
      ],
    });

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as unknown as ArrayBuffer);
    const visible = wb.worksheets.filter((ws) => ws.state !== 'hidden').map((ws) => ws.name);

    // инструкция и единицы — первыми, иначе пользователь до них не доезжает
    expect(visible.slice(0, 2)).toEqual(['Как заполнять', 'Единицы']);
    expect(visible.slice(2)).toEqual(['Электромонтаж', 'Плиточные']);
    // служебные листы скрыты и разбор их не считает категориями
    const parsed = await service.parse(buffer);
    expect(parsed.sheets.map((s) => s.sheet)).toEqual(['Электромонтаж', 'Плиточные']);
  });

  it('читает чужой файл: колонки по шапке, template = false', async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Прайс поставщика');
    ws.addRow(['Наименование', 'Артикул', 'Ед. изм.', 'Цена']);
    ws.addRow(['Кабель ВВГ 3х2.5', 'CBL-1', 'м', 95]);
    const buffer = Buffer.from((await wb.xlsx.writeBuffer()) as unknown as ArrayBuffer);

    const parsed = await service.parse(buffer);
    expect(parsed.template).toBe(false);
    expect(parsed.kind).toBeNull();
    expect(parsed.sheets).toHaveLength(1);
    expect(parsed.sheets[0].rows[0]).toMatchObject({
      name: 'Кабель ВВГ 3х2.5',
      article: 'CBL-1',
      price: 95,
      unitRaw: 'м',
    });
  });

  it('служебные листы (Единицы, Как заполнять, _meta, _categories) не импортируются', async () => {
    const buffer = await service.build({
      catalogId: 1,
      catalogName: 'X',
      kind: PriceKind.MATERIAL,
      sheets: [],
    });
    const parsed = await service.parse(buffer);
    expect(parsed.sheets.map((s) => s.sheet)).toEqual(['Разное']);
    expect(parsed.kind).toBe('MATERIAL');
  });
});
