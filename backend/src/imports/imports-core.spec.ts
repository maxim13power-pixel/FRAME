// backend/src/imports/imports-core.spec.ts
// ⭐ №202: парсер, нормализация и матчер — чистые функции без БД.
import * as ExcelJS from 'exceljs';
import { EstimateParserService } from './estimate-parser.service';
import { matchRow } from './price-matcher';
import { normalizeUnit } from './unit-normalizer';
import { normalizeArticle, normalizeText, parseNumberRu } from './name-normalizer';
import type { CatalogItem } from './imports.types';

const parser = new EstimateParserService();

describe('normalizeUnit (№202)', () => {
  it('распознаёт синонимы и помечает приблизительные', () => {
    expect(normalizeUnit('шт').unit).toBe('PIECE');
    expect(normalizeUnit('м2').unit).toBe('SQUARE_METER');
    expect(normalizeUnit('м²').unit).toBe('SQUARE_METER');
    expect(normalizeUnit('куб. м').unit).toBe('CUBIC_METER');
    expect(normalizeUnit('упак').unit).toBe('PACKAGE');
    expect(normalizeUnit('пог.м')).toEqual({ unit: 'METER', approx: true });
  });

  it('неизвестная единица — это ошибка, а не «шт» по умолчанию', () => {
    expect(normalizeUnit('лист').unit).toBeNull();
    expect(normalizeUnit('').unit).toBeNull();
    expect(normalizeUnit(null).unit).toBeNull();
  });
});

describe('normalize/parse чисел и артикулов (№202)', () => {
  it('русские форматы чисел', () => {
    expect(parseNumberRu('1 234,56')).toBe(1234.56);
    expect(parseNumberRu('12,5')).toBe(12.5);
    expect(parseNumberRu('1.234,56')).toBe(1234.56);
    expect(parseNumberRu('1 200 ₽')).toBe(1200);
    expect(parseNumberRu('—')).toBeNull();
  });

  it('название и артикул нормализуются одинаково для файла и справочника', () => {
    expect(normalizeText('  Стяжка  ПОЛА  ')).toBe('стяжка пола');
    expect(normalizeText('Клей ёмкость')).toBe('клей емкость');
    expect(normalizeArticle(' ab-12 3 ')).toBe('AB123');
  });
});

describe('EstimateParserService (№202)', () => {
  const matrix = [
    ['Смета на отделку', null, null, null],
    ['№', 'Наименование', 'Ед. изм.', 'Кол-во', 'Цена'],
    [1, 'Укладка плитки 300х300', 'м2', '12,5', '1 200'],
    [2, 'Грунтовка стен', 'м2', '80', '150'],
    ['', 'Итого', '', '', '27000'],
  ];

  it('находит шапку, колонки и пропускает итоговые строки', () => {
    const parsed = parser.parseRows(matrix, 'paste');
    expect(parsed.columns.headerRow).toBe(2);
    expect(parsed.columns.name).toBe(1);
    expect(parsed.columns.unit).toBe(2);
    expect(parsed.columns.qty).toBe(3);
    expect(parsed.columns.price).toBe(4);
    expect(parsed.rows.map((r) => r.name)).toEqual(['Укладка плитки 300х300', 'Грунтовка стен']);
    expect(parsed.rows[0].row).toBe(3);
  });

  it('читает xlsx-буфер (чужой файл, шапка не в первой строке)', async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Смета');
    ws.addRow(['Объект: ЖК Северный']);
    ws.addRow(['Наименование', 'Артикул', 'Ед.', 'Количество', 'Цена']);
    ws.addRow(['Клей плиточный 25 кг', 'cer-25', 'меш', 10, 450]);
    const buffer = Buffer.from(await wb.xlsx.writeBuffer());

    const parsed = await parser.parseBuffer(buffer, 'smeta.xlsx');
    expect(parsed.sheet).toBe('Смета');
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0]).toMatchObject({
      name: 'Клей плиточный 25 кг',
      article: 'cer-25',
      unitRaw: 'меш',
      qtyRaw: '10',
    });
  });

  it('пустая таблица или только шапка — ошибка с понятным текстом', () => {
    expect(() => parser.parseRows([['Наименование', 'Кол-во']], 'bad')).toThrow();
    expect(() => parser.parseRows([], 'bad')).toThrow();
  });
});

describe('matchRow (№202)', () => {
  const catalog: CatalogItem[] = [
    { id: 1, name: 'Укладка плитки 300х300', article: 'PL-300', unit: 'SQUARE_METER', price: 950, kind: 'WORK', category: 'Плиточные' },
    { id: 2, name: 'Укладка плитки 600х600', article: 'PL-600', unit: 'SQUARE_METER', price: 1200, kind: 'WORK', category: 'Плиточные' },
    { id: 3, name: 'Грунтовка стен', article: null, unit: 'SQUARE_METER', price: 150, kind: 'WORK', category: 'Отделка' },
    { id: 4, name: 'Клей плиточный 25 кг', article: 'CER-25', unit: 'BAG', price: 450, kind: 'WORK', category: 'Материалы' },
  ];

  it('артикул — точное совпадение', () => {
    const m = matchRow({ name: 'Плитка укладка', article: 'pl-300', unit: 'SQUARE_METER' }, catalog);
    expect(m.status).toBe('EXACT');
    expect(m.priceItemId).toBe(1);
    expect(m.price).toBe(950);
  });

  it('точное название + единица', () => {
    const m = matchRow({ name: 'Грунтовка  стен', article: null, unit: 'SQUARE_METER' }, catalog);
    expect(m.status).toBe('EXACT');
    expect(m.priceItemId).toBe(3);
  });

  it('числа в названии разные ⇒ не автопривязка', () => {
    const m = matchRow({ name: 'Укладка плитки 500х500', article: null, unit: 'SQUARE_METER' }, catalog);
    expect(m.status).not.toBe('EXACT');
    expect(m.score).toBeLessThanOrEqual(0.85);
  });

  it('чужая единица ⇒ score режется, автопривязки нет', () => {
    const m = matchRow({ name: 'Клей плиточный 25 кг', article: null, unit: 'PIECE' }, catalog);
    expect(m.status).not.toBe('EXACT');
  });

  it('нет похожего ⇒ NONE (никаких «единственный кандидат»)', () => {
    const m = matchRow({ name: 'Монтаж лифта', article: null, unit: 'PIECE' }, catalog);
    expect(m.status).toBe('NONE');
    expect(m.priceItemId).toBeNull();
  });
});
