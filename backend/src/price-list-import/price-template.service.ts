// backend/src/price-list-import/price-template.service.ts
// ⭐ №273 (§121): шаблон/выгрузка прайс-листа и его разбор.
// Лист = категория. Шаблон работ и шаблон материалов различаются скрытым листом `_meta`,
// поэтому загрузить «не тот» файл можно распознать и сказать об этом прямо.
import { BadRequestException, Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import type { PriceKind, Unit } from '@prisma/client';
import { parseNumberRu } from '../imports/name-normalizer';
import { unitLabelRu } from '../imports/unit-normalizer';

export const TEMPLATE_VERSION = 1;
export const META_SHEET = '_meta';
export const CATEGORY_SHEET = '_categories';
export const HELP_SHEET = 'Как заполнять';
export const UNITS_SHEET = 'Единицы';
export const SERVICE_SHEETS = new Set(
  [META_SHEET, CATEGORY_SHEET, HELP_SHEET, UNITS_SHEET].map((n) => n.toLowerCase()),
);

/** Единицы для выпадающего списка — порядок как в интерфейсе */
const UNIT_ORDER: Unit[] = [
  'PIECE',
  'METER',
  'LINEAR_METER',
  'SQUARE_METER',
  'CUBIC_METER',
  'KILOGRAM',
  'LITER',
  'TON',
  'BAG',
  'PACKAGE',
  'SET',
];

const HEADERS = ['Наименование', 'Артикул', 'Ед. изм.', 'Цена за ед.', 'Примечание', 'ID'];
/** Пустые строки под ручное заполнение — сверх уже существующих позиций */
const EMPTY_ROWS = 30;

const LINE = 'FFB0BEC5';
const BORDER: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: LINE } },
  left: { style: 'thin', color: { argb: LINE } },
  bottom: { style: 'thin', color: { argb: LINE } },
  right: { style: 'thin', color: { argb: LINE } },
};
const HEADER_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFE3F2FD' },
};

export interface TemplateItemInput {
  /** ⭐ №339: у шаблона-образца ID нет — при импорте позиции создаются по названию */
  id?: number;
  name: string;
  article: string | null;
  unit: Unit;
  price: number;
  note?: string | null;
}

export interface TemplateSheetInput {
  sheet: string;
  category: string;
  items: TemplateItemInput[];
}

export interface BuildTemplateInput {
  catalogId: number;
  catalogName: string;
  kind: PriceKind;
  sheets: TemplateSheetInput[];
}

export interface ParsedPriceRow {
  row: number;
  id: number | null;
  name: string;
  article: string | null;
  unitRaw: string | null;
  price: number | null;
  note: string | null;
}

export interface ParsedPriceSheet {
  sheet: string;
  category: string;
  rows: ParsedPriceRow[];
}

export interface ParsedPriceWorkbook {
  /** наш ли это шаблон (есть `_meta` с framePriceTemplate) */
  template: boolean;
  kind: PriceKind | null;
  catalogId: number | null;
  catalogName: string | null;
  sheets: ParsedPriceSheet[];
}

/** Имя листа Excel: ≤31 символ, без []:*?/\ и без дублей */
const sanitizeSheetName = (raw: string, used: Set<string>): string => {
  const base =
    raw
      .replace(/[[\]:*?/\\]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 31) || 'Разное';
  let name = base;
  let index = 2;
  while (used.has(name.toLowerCase())) {
    const suffix = ` ${index}`;
    name = `${base.slice(0, 31 - suffix.length)}${suffix}`;
    index += 1;
  }
  used.add(name.toLowerCase());
  return name;
};

/** Значение ячейки → текст (rich text, формулы и гиперссылки тоже) */
const cellText = (value: unknown): string => {
  if (value == null) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') {
    const v = value as {
      text?: unknown;
      richText?: { text?: string }[];
      result?: unknown;
      hyperlink?: unknown;
    };
    if (typeof v.text === 'string') return v.text.trim();
    if (Array.isArray(v.richText)) return v.richText.map((part) => part.text ?? '').join('').trim();
    if (v.result != null) return cellText(v.result);
    if (v.hyperlink) return String(v.hyperlink);
  }
  return String(value).trim();
};

@Injectable()
export class PriceTemplateService {
  /** Excel-файл: текущие позиции справочника + пустые строки под заполнение */
  async build(input: BuildTemplateInput): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'FRAME';

    // ⭐ №289: «Как заполнять» и «Единицы» — ПЕРВЫМИ листами.
    // Раньше они лежали в конце файла, пользователь до них не «доезжал»
    // и заполнял единицы измерения наугад (ошибки при импорте).
    this.writeHelp(wb, input.kind);
    this.writeUnits(wb);

    const used = new Set(SERVICE_SHEETS);
    const pairs: { sheet: string; category: string }[] = [];
    const source =
      input.sheets.length > 0
        ? input.sheets
        : [{ sheet: 'Разное', category: 'Разное', items: [] as TemplateItemInput[] }];

    for (const item of source) {
      const sheetName = sanitizeSheetName(item.sheet || item.category, used);
      pairs.push({ sheet: sheetName, category: item.category || sheetName });
      this.writeDataSheet(wb.addWorksheet(sheetName), item.items);
    }

    // служебные скрытые листы — в конце: на табах их всё равно не видно
    this.writeMeta(wb, input);
    this.writeCategories(wb, pairs);

    // ⭐ №289: файл открывается на инструкции, а не на первом листе категории
    wb.views = [
      {
        x: 0,
        y: 0,
        width: 20000,
        height: 12000,
        firstSheet: 0,
        activeTab: 0,
        visibility: 'visible',
      },
    ];

    const buffer = await wb.xlsx.writeBuffer();
    return Buffer.from(buffer as unknown as ArrayBuffer);
  }

  private writeDataSheet(ws: ExcelJS.Worksheet, items: TemplateItemInput[]): void {
    ws.columns = [
      { width: 46 },
      { width: 14 },
      { width: 12 },
      { width: 14 },
      { width: 26 },
      { width: 10 },
    ];
    const header = ws.getRow(1);
    HEADERS.forEach((title, index) => {
      const cell = header.getCell(index + 1);
      cell.value = title;
      cell.font = { bold: true, color: { argb: 'FF04164B' } };
      cell.fill = HEADER_FILL;
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      cell.border = BORDER;
    });
    header.height = 28;
    ws.views = [{ state: 'frozen', ySplit: 1 }];
    ws.getColumn(6).hidden = true; // ID — служебная колонка, менять нельзя

    const lastRow = Math.max(200, items.length + EMPTY_ROWS + 2);
    // Типы exceljs не описывают `dataValidations` на листе, но в рантайме свойство есть.
    const withValidation = ws as unknown as {
      dataValidations: { add(range: string, validation: ExcelJS.DataValidation): void };
    };
    withValidation.dataValidations.add(`C2:C${lastRow}`, {
      type: 'list',
      allowBlank: true,
      formulae: [`"${UNIT_ORDER.map((u) => unitLabelRu(u)).join(',')}"`],
      showErrorMessage: false,
    });

    items.forEach((item, index) => {
      const row = ws.getRow(index + 2);
      row.getCell(1).value = item.name;
      row.getCell(2).value = item.article ?? '';
      row.getCell(3).value = unitLabelRu(item.unit);
      row.getCell(4).value = item.price;
      row.getCell(4).numFmt = '#,##0.00';
      row.getCell(5).value = item.note ?? '';
      row.getCell(6).value = item.id ?? '';
      for (let c = 1; c <= HEADERS.length; c += 1) row.getCell(c).border = BORDER;
    });

    // Пустые строки: держим формат цены и рамку, чтобы руками писать было удобно
    for (let i = 0; i < EMPTY_ROWS; i += 1) {
      const row = ws.getRow(items.length + 2 + i);
      row.getCell(4).numFmt = '#,##0.00';
      for (let c = 1; c <= HEADERS.length; c += 1) row.getCell(c).border = BORDER;
    }
  }

  private writeMeta(wb: ExcelJS.Workbook, input: BuildTemplateInput): void {
    const meta = wb.addWorksheet(META_SHEET);
    meta.addRow(['ключ', 'значение']);
    meta.addRow(['framePriceTemplate', TEMPLATE_VERSION]);
    meta.addRow(['kind', input.kind]);
    meta.addRow(['catalogId', input.catalogId]);
    meta.addRow(['catalogName', input.catalogName]);
    meta.addRow(['exportedAt', new Date().toISOString()]);
    meta.getColumn(1).width = 24;
    meta.getColumn(2).width = 48;
    meta.state = 'hidden';
  }

  private writeCategories(
    wb: ExcelJS.Workbook,
    pairs: { sheet: string; category: string }[],
  ): void {
    const ws = wb.addWorksheet(CATEGORY_SHEET);
    ws.addRow(['Лист', 'Категория']);
    for (const pair of pairs) ws.addRow([pair.sheet, pair.category]);
    ws.getColumn(1).width = 32;
    ws.getColumn(2).width = 48;
    ws.state = 'hidden';
  }

  private writeHelp(wb: ExcelJS.Workbook, kind: PriceKind): void {
    const isWork = kind === 'WORK';
    const lines = [
      isWork ? 'Шаблон РАБОТ' : 'Шаблон МАТЕРИАЛОВ',
      '',
      '1. Один лист — одна категория. Заполняйте колонки: Наименование, Ед. изм., Цена за ед.',
      '2. Нужна новая категория — просто добавьте лист: он станет категорией с этим названием.',
      '3. Ненужные листы можно удалить или оставить пустыми — пустые листы не импортируются.',
      '4. Лист можно переименовать: позиции этого листа переедут в новую категорию.',
      '5. «Ед. изм.» — выберите из списка (шт, м, пог. м, м², м³, кг, л, т, мешок, упак, компл).',
      '6. Если единица не распознана, позиция сохранится черновиком — её можно уточнить в справочнике.',
      '7. Колонку ID не меняйте: по ней импорт обновляет существующие позиции, а не создаёт дубли.',
      '8. Артикул — ваш код поставщика, необязателен.',
      '',
      `Импорт: «Справочник цен» → вкладка «${isWork ? 'Работы' : 'Материалы'}» → «Импорт из Excel».`,
    ];
    const ws = wb.addWorksheet(HELP_SHEET);
    for (const line of lines) ws.addRow([line]);
    ws.getColumn(1).width = 110;
  }

  private writeUnits(wb: ExcelJS.Workbook): void {
    const ws = wb.addWorksheet(UNITS_SHEET);
    ws.addRow(['Можно писать так', 'Единица в FRAME']);
    const hints: Record<Unit, string> = {
      PIECE: 'шт, штук, ед., рулон, бухта, лист',
      METER: 'м, метр, мтр',
      LINEAR_METER: 'пог. м, п.м., пм, мп',
      SQUARE_METER: 'м2, м², кв.м, м.кв',
      CUBIC_METER: 'м3, м³, куб.м',
      KILOGRAM: 'кг, килограмм',
      LITER: 'л, литр',
      TON: 'т, тн, тонна',
      BAG: 'мешок, меш',
      PACKAGE: 'упак, уп, пачка, коробка',
      SET: 'компл, комплект, набор',
    };
    for (const unit of UNIT_ORDER) ws.addRow([hints[unit], unitLabelRu(unit)]);
    ws.getColumn(1).width = 46;
    ws.getColumn(2).width = 18;
  }

  /** Разбор файла. Ошибка чтения — 400 с понятным текстом (не «file too large»). */
  async parse(buffer: Buffer): Promise<ParsedPriceWorkbook> {
    const wb = new ExcelJS.Workbook();
    try {
      await wb.xlsx.load(buffer as unknown as ArrayBuffer);
    } catch {
      throw new BadRequestException(
        'Не удалось прочитать файл. Нужен .xlsx (Excel 2007+); старый .xls не поддержан.',
      );
    }

    const meta = this.readMeta(wb);
    const categoryBySheet = this.readCategoryMap(wb);

    const sheets: ParsedPriceSheet[] = [];
    for (const ws of wb.worksheets) {
      const name = ws.name.trim();
      if (SERVICE_SHEETS.has(name.toLowerCase())) continue;
      sheets.push({
        sheet: name,
        category: categoryBySheet.get(name.toLowerCase()) ?? name,
        rows: this.readSheet(ws),
      });
    }

    return {
      template: meta.template,
      kind: meta.kind,
      catalogId: meta.catalogId,
      catalogName: meta.catalogName,
      sheets,
    };
  }

  private readMeta(wb: ExcelJS.Workbook): {
    template: boolean;
    kind: PriceKind | null;
    catalogId: number | null;
    catalogName: string | null;
  } {
    const ws = wb.getWorksheet(META_SHEET);
    if (!ws) return { template: false, kind: null, catalogId: null, catalogName: null };
    const map = new Map<string, string>();
    ws.eachRow((row, index) => {
      if (index === 1) return;
      const key = cellText(row.getCell(1).value).toLowerCase();
      if (key) map.set(key, cellText(row.getCell(2).value));
    });
    const version = Number(map.get('framepricetemplate'));
    const kindRaw = (map.get('kind') ?? '').toUpperCase();
    const catalogId = Number(map.get('catalogid'));
    return {
      template: Number.isFinite(version) && version > 0,
      kind: kindRaw === 'WORK' || kindRaw === 'MATERIAL' ? (kindRaw as PriceKind) : null,
      catalogId: Number.isInteger(catalogId) && catalogId > 0 ? catalogId : null,
      catalogName: map.get('catalogname') || null,
    };
  }

  private readCategoryMap(wb: ExcelJS.Workbook): Map<string, string> {
    const map = new Map<string, string>();
    const ws = wb.getWorksheet(CATEGORY_SHEET);
    if (!ws) return map;
    ws.eachRow((row, index) => {
      if (index === 1) return;
      const sheet = cellText(row.getCell(1).value).toLowerCase();
      const category = cellText(row.getCell(2).value);
      if (sheet && category) map.set(sheet, category);
    });
    return map;
  }

  /** Колонки по шапке; если шапки нет — фиксированные A..F (как в шаблоне) */
  private detectColumns(ws: ExcelJS.Worksheet): {
    name: number;
    article: number;
    unit: number;
    price: number;
    note: number;
    id: number;
  } {
    const fallback = { name: 1, article: 2, unit: 3, price: 4, note: 5, id: 6 };
    const found: Record<string, number> = {};
    ws.getRow(1).eachCell((cell, col) => {
      const text = cellText(cell.value).toLowerCase().replace(/\s+/g, ' ');
      if (!text) return;
      // Порядок важен: «Цена за ед.» содержит «ед» и не должна стать колонкой единицы
      if (text.includes('наимен')) found.name = col;
      else if (text.includes('артикул')) found.article = col;
      else if (text.includes('цена') || text.includes('стоим')) found.price = col;
      else if (text.includes('примеч')) found.note = col;
      else if (text === 'id' || text === 'ид') found.id = col;
      else if (/^(ед|единиц)/.test(text)) found.unit = col;
    });
    if (!found.name) return fallback;
    return {
      name: found.name,
      article: found.article ?? 2,
      unit: found.unit ?? 3,
      price: found.price ?? 4,
      note: found.note ?? 5,
      id: found.id ?? 6,
    };
  }

  private readSheet(ws: ExcelJS.Worksheet): ParsedPriceRow[] {
    const cols = this.detectColumns(ws);
    const rows: ParsedPriceRow[] = [];
    ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber === 1) return;
      const name = cellText(row.getCell(cols.name).value);
      if (!name) return;
      const low = name.toLowerCase();
      if (low.startsWith('итого') || low.startsWith('всего') || low.startsWith('ндс')) return;
      const priceCell = row.getCell(cols.price).value;
      const price = typeof priceCell === 'number' ? priceCell : parseNumberRu(cellText(priceCell));
      const idValue = Number(cellText(row.getCell(cols.id).value));
      rows.push({
        row: rowNumber,
        id: Number.isInteger(idValue) && idValue > 0 ? idValue : null,
        name,
        article: cellText(row.getCell(cols.article).value) || null,
        unitRaw: cellText(row.getCell(cols.unit).value) || null,
        price: price != null && price >= 0 ? price : null,
        note: cellText(row.getCell(cols.note).value) || null,
      });
    });
    return rows;
  }
}



