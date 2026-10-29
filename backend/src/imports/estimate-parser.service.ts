// backend/src/imports/estimate-parser.service.ts
// ⭐ №202 (RFC §8.1): xlsx/csv → сырые строки + автоопределение колонок.
// Принимаем ЧУЖОЙ файл: ищем шапку в первых строках по синонимам, а не требуем свой шаблон.
import { BadRequestException, Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import type {
  DetectedColumns,
  ImportMetaInfo,
  ParsedEstimate,
  ParsedRow,
} from './imports.types';

const HEADER_SYNONYMS: Record<'name' | 'article' | 'unit' | 'qty' | 'price', string[]> = {
  name: ['наименование', 'название', 'позиция', 'описание', 'номенклатура', 'вид работ', 'работа', 'материал'],
  article: ['артикул', 'код', 'шифр'],
  unit: ['ед изм', 'единица', 'ед.', 'ед', 'изм'],
  // ⭐ №208: «По спецификации» — колонка количества в НАШЕЙ выгрузке сметы.
  // Без этого синонима собственный экспорт FRAME не читался обратно.
  qty: [
    'кол во',
    'количество',
    'объем',
    'объём',
    'кол.',
    'по спецификации',
    'спецификация',
  ],
  price: [
    'цена',
    'стоимость',
    'расценка',
    'цена за ед',
    'цена за единицу',
    'стоимость за ед',
    'цена руб',
    'цена, руб',
  ],
};

const normCell = (v: unknown): string =>
  String(v ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[.:-]/g, ' ')
    .replace(/[\s\u00A0\u202F]+/g, ' ')
    .trim();

const hit = (cell: string, synonyms: string[]): boolean =>
  synonyms.some((s) => cell === s || cell.startsWith(`${s} `) || cell.includes(s));

@Injectable()
export class EstimateParserService {
  /** Excel-файл (xlsx) или CSV/TSV-текст в буфере */
  async parseBuffer(buffer: Buffer, fileName: string): Promise<ParsedEstimate> {
    const lower = fileName.toLowerCase();
    if (lower.endsWith('.csv') || lower.endsWith('.txt')) {
      const text = buffer.toString('utf8');
      return this.parseRows(textToMatrix(text), fileName);
    }
    const workbook = new ExcelJS.Workbook();
    try {
      await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
    } catch {
      throw new BadRequestException(
        'Не удалось прочитать файл. Нужен .xlsx (Excel 2007+) или .csv — старый .xls не поддержан.',
      );
    }

    const sheets = workbook.worksheets.map((w) => w.name);
    // ⭐ №208: скрытый лист `_meta` — признак нашего файла (выгрузка сметы или шаблон).
    const meta = readMeta(workbook);
    // Берём первый лист, где есть хоть одна непустая строка (служебный `_meta` пропускаем)
    const sheet =
      workbook.worksheets.find((w) => w.name.trim().toLowerCase() !== '_meta' && w.rowCount > 0) ??
      workbook.worksheets.find((w) => w.name.trim().toLowerCase() !== '_meta');
    if (!sheet) {
      throw new BadRequestException('В файле нет листов с данными.');
    }
    return { ...this.parseRows(sheetToMatrix(sheet), fileName, sheet.name, sheets), meta };
  }

  /** Вставка из буфера обмена (TSV) или готовые строки из JSON */
  parseRows(
    matrix: unknown[][],
    fileName: string,
    sheetName = 'Вставка',
    sheets: string[] = [sheetName],
  ): ParsedEstimate {
    if (!Array.isArray(matrix) || matrix.length === 0) {
      throw new BadRequestException('Пустая таблица: нет строк для импорта.');
    }
    const { headerIndex, columns } = detectHeader(matrix);
    // ⭐ №208: без колонки «Наименование» импорт бессмысленен — говорим об этом прямо,
    // вместо того чтобы молча читать первую колонку.
    const nameColumn = columns.name;
    if (nameColumn == null) {
      throw new BadRequestException(
        'Не найдена строка заголовков: нужна колонка «Наименование» (и желательно «Ед. изм.», «Количество», «Цена»). Проверьте, что шапка есть в первых 12 строках листа.',
      );
    }
    const rows: ParsedRow[] = [];
    for (let i = headerIndex + 1; i < matrix.length; i += 1) {
      const line = matrix[i] ?? [];
      const name = String(line[nameColumn] ?? '').trim();
      const low = normCell(name);
      // Итоговые строки пропускаем: это не позиции сметы
      if (!name || low.startsWith('итого') || low.startsWith('всего') || low.startsWith('ндс')) continue;
      rows.push({
        row: i + 1,
        name,
        article: columns.article != null ? String(line[columns.article] ?? '').trim() || null : null,
        qtyRaw: columns.qty != null ? String(line[columns.qty] ?? '').trim() || null : null,
        unitRaw: columns.unit != null ? String(line[columns.unit] ?? '').trim() || null : null,
        priceRaw: columns.price != null ? String(line[columns.price] ?? '').trim() || null : null,
      });
    }
    if (rows.length === 0) {
      throw new BadRequestException(
        'В файле не нашлось строк смет: проверьте, что есть колонка «Наименование».',
      );
    }
    return {
      sheet: sheetName,
      sheets,
      rows,
      columns: {
        name: nameColumn,
        article: columns.article,
        unit: columns.unit,
        qty: columns.qty,
        price: columns.price,
        headerRow: headerIndex + 1,
        confidence: columns.confidence,
      },
    };
  }
}


/** ⭐ №208: читаем скрытый лист `_meta` (пара «ключ — значение» в первых двух колонках) */
const readMeta = (workbook: ExcelJS.Workbook): ImportMetaInfo | null => {
  const sheet = workbook.worksheets.find((w) => w.name.trim().toLowerCase() === '_meta');
  if (!sheet) return null;
  const pairs = new Map<string, string>();
  sheet.eachRow((row) => {
    const key = String(row.getCell(1).value ?? '').trim();
    if (!key) return;
    pairs.set(key, String(row.getCell(2).value ?? '').trim());
  });
  if (pairs.size === 0) return null;
  const num = (key: string): number | undefined => {
    const raw = pairs.get(key);
    if (raw == null || raw === '') return undefined;
    const n = Number(raw.replace(',', '.'));
    return Number.isFinite(n) ? n : undefined;
  };
  return {
    frameExport: num('frameExport'),
    templateVersion: num('columnsVersion') ?? num('templateVersion'),
    projectId: num('projectId'),
    projectName: pairs.get('projectName') || undefined,
    objectName: pairs.get('objectName') || undefined,
    includePrices: pairs.get('includePrices') === '1',
  };
};

/** Шапка: ищем строку, где опознано максимум колонок (в первых 12 строках). */
export const detectHeader = (
  matrix: unknown[][],
): {
  headerIndex: number;
  columns: {
    name: number | null;
    article: number | null;
    unit: number | null;
    qty: number | null;
    price: number | null;
    confidence: number;
  };
} => {
  let best = { headerIndex: 0, columns: emptyColumns(), score: -1 };
  const limit = Math.min(matrix.length, 12);

  for (let i = 0; i < limit; i += 1) {
    const cells = (matrix[i] ?? []).map(normCell);
    const found = emptyColumns();
    cells.forEach((cell, idx) => {
      if (!cell) return;
      if (found.name == null && hit(cell, HEADER_SYNONYMS.name)) found.name = idx;
      else if (found.unit == null && hit(cell, HEADER_SYNONYMS.unit)) found.unit = idx;
      else if (found.qty == null && hit(cell, HEADER_SYNONYMS.qty)) found.qty = idx;
      else if (found.price == null && hit(cell, HEADER_SYNONYMS.price)) found.price = idx;
      else if (found.article == null && hit(cell, HEADER_SYNONYMS.article)) found.article = idx;
    });
    const score = [found.name, found.unit, found.qty, found.price, found.article].filter(
      (v) => v != null,
    ).length;
    if (score > best.score) best = { headerIndex: i, columns: found, score };
  }

  const columns = best.columns;
  const matched = [columns.name, columns.unit, columns.qty, columns.price].filter(
    (v) => v != null,
  ).length;
  return {
    headerIndex: best.headerIndex,
    columns: {
      // ⭐ №208: name остаётся null, если шапку не опознали — parseRows скажет об этом явно
      name: columns.name,
      article: columns.article,
      unit: columns.unit,
      qty: columns.qty,
      price: columns.price,
      confidence: Math.round((matched / 4) * 100) / 100,
    },
  };
};

const emptyColumns = (): {
  name: number | null;
  article: number | null;
  unit: number | null;
  qty: number | null;
  price: number | null;
  confidence: number;
} => ({
  name: null,
  article: null,
  unit: null,
  qty: null,
  price: null,
  confidence: 0,
});

/** Лист Excel → матрица значений (формулы берём как результат) */
const sheetToMatrix = (sheet: ExcelJS.Worksheet): unknown[][] => {
  const matrix: unknown[][] = [];
  sheet.eachRow({ includeEmpty: true }, (row) => {
    const values: unknown[] = [];
    row.eachCell({ includeEmpty: true }, (cell) => {
      const v = cell.value as unknown;
      if (v && typeof v === 'object' && 'result' in (v as object)) {
        values.push((v as { result?: unknown }).result ?? null);
      } else if (v && typeof v === 'object' && 'richText' in (v as object)) {
        const parts = (v as { richText?: { text: string }[] }).richText ?? [];
        values.push(parts.map((p) => p.text).join(''));
      } else {
        values.push(v ?? null);
      }
    });
    matrix.push(values);
  });
  return matrix;
};

/** CSV/TSV: разделитель определяем по первой строке (табуляция, ; или ,) */
const textToMatrix = (text: string): unknown[][] => {
  const lines = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .filter((l) => l.trim());
  if (lines.length === 0) return [];
  const sample = lines[0];
  const delimiter = sample.includes('\t') ? '\t' : sample.includes(';') ? ';' : ',';
  return lines.map((line) => line.split(delimiter).map((c) => c.replace(/^"|"$/g, '').trim()));
};
