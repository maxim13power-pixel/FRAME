// backend/src/imports/estimate-parser.service.ts
// ⭐ №202 (RFC §8.1): xlsx/csv → сырые строки + автоопределение колонок.
// Принимаем ЧУЖОЙ файл: ищем шапку в первых строках по синонимам, а не требуем свой шаблон.
import { BadRequestException, Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import type { DetectedColumns, ParsedEstimate, ParsedRow } from './imports.types';

const HEADER_SYNONYMS: Record<'name' | 'article' | 'unit' | 'qty' | 'price', string[]> = {
  name: ['наименование', 'название', 'позиция', 'описание', 'номенклатура', 'вид работ', 'работа', 'материал'],
  article: ['артикул', 'код', 'шифр'],
  unit: ['ед изм', 'единица', 'ед.', 'ед', 'изм'],
  qty: ['кол во', 'количество', 'объем', 'объём', 'кол.'],
  price: ['цена', 'стоимость', 'расценка', 'цена за ед'],
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
    // Берём первый лист, где есть хоть одна непустая строка
    const sheet = workbook.worksheets.find((w) => w.rowCount > 0) ?? workbook.worksheets[0];
    if (!sheet) {
      throw new BadRequestException('В файле нет листов с данными.');
    }
    return this.parseRows(sheetToMatrix(sheet), fileName, sheet.name, sheets);
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
    const rows: ParsedRow[] = [];
    for (let i = headerIndex + 1; i < matrix.length; i += 1) {
      const line = matrix[i] ?? [];
      const name = String(line[columns.name] ?? '').trim();
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
      columns: { ...columns, headerRow: headerIndex + 1 },
    };
  }
}


/** Шапка: ищем строку, где опознано максимум колонок (в первых 12 строках). */
export const detectHeader = (
  matrix: unknown[][],
): { headerIndex: number; columns: Omit<DetectedColumns, 'headerRow'> } => {
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
  // «Наименование» обязательно; если не нашли — берём первую колонку и предупреждаем
  const nameIndex = columns.name ?? 0;
  const matched = [columns.name, columns.unit, columns.qty, columns.price].filter(
    (v) => v != null,
  ).length;
  return {
    headerIndex: best.headerIndex,
    columns: {
      name: nameIndex,
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
