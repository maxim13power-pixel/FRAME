// backend/src/common/keyset.ts
// ⭐ №391: keyset-пагинация журналов (склад, аудит, отчёты).
// Смещение (offset) «плывёт» при вставке новой записи, а курсор по (дата, id) — нет.
// Старое поведение сохраняется: без `limit` эндпоинты отвечают массивом, как раньше.
import { BadRequestException } from '@nestjs/common';

export type KeysetCursor = { at: Date; id: number };
export type KeysetField = 'createdAt' | 'updatedAt';

/** Сколько записей отдать: null — «как раньше, без пагинации». */
export function parseLimit(
  raw: unknown,
  max = 200,
  min = 1,
): number | null {
  if (raw === undefined || raw === null || raw === '') return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < min) {
    throw new BadRequestException('limit: ожидается положительное число');
  }
  return Math.min(Math.floor(n), max);
}

export function encodeCursor(at: Date, id: number): string {
  return `${at.toISOString()}|${id}`;
}

/** Курсор — «прозрачная» строка `ISO|id`; мусор отвергаем. */
export function parseCursor(raw: unknown): KeysetCursor | null {
  if (raw === undefined || raw === null || raw === '') return null;
  const value = String(raw);
  const sep = value.lastIndexOf('|');
  if (sep <= 0) throw new BadRequestException('cursor: неверный формат');
  const rawAt = value.slice(0, sep);
  const rawId = value.slice(sep + 1).trim();
  const at = new Date(rawAt);
  // Number('') === 0 — пустой id нельзя принимать за «нулевую» запись
  const id = rawId === '' ? NaN : Number(rawId);
  if (Number.isNaN(at.getTime()) || !Number.isInteger(id) || id < 0) {
    throw new BadRequestException('cursor: неверный формат');
  }
  return { at, id };
}

/**
 * Условие «строго после курсора» для сортировки по убыванию (дата, id).
 * Ключ составной: одинаковые даты не теряют строки и не дублируют их.
 */
export function keysetWhere(
  cursor: KeysetCursor | null,
  field: KeysetField,
): Record<string, unknown> {
  if (!cursor) return {};
  return {
    OR: [
      { [field]: { lt: cursor.at } },
      { [field]: cursor.at, id: { lt: cursor.id } },
    ],
  };
}

export type KeysetPage<T> = {
  items: T[];
  total: number;
  nextCursor: string | null;
};

/**
 * Собирает конверт страницы. `rows` приходит с запасом +1 — по нему понимаем,
 * есть ли следующая страница. Курсор берём от последней ОТДАННОЙ записи.
 */
export function buildKeysetPage<T extends { id: number }>(
  rows: T[],
  limit: number,
  total: number,
  atOf: (row: T) => Date,
): KeysetPage<T> {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const last = items[items.length - 1];
  return {
    items,
    total,
    nextCursor: hasMore && last ? encodeCursor(atOf(last), last.id) : null,
  };
}
