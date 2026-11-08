// backend/src/analytics/analytics.months.ts
// ⭐ №226 (§72, P3-4): «динамика по месяцам» — в зоне ПОЛЬЗОВАТЕЛЯ, а не UTC сервера.
// Раньше бакеты считались `date_trunc('month', m."createdAt")` в TZ базы, поэтому
// 01.11 00:00 по зоне +04 (= 31.10 20:00 UTC) попадало в октябрь, а для пользователя +04
// первый день месяца до 04:00 считался прошлым месяцем. Плюс источником была дата
// СОЗДАНИЯ строки сметы, а не дата фиксации.

/**
 * tzOffsetMinutes = Date#getTimezoneOffset(): минуты, UTC − локальное.
 * Для UTC+04 это −240, для UTC−03 это +180.
 */
export interface MonthPoint {
  /** 'YYYY-MM' */
  month: string;
  spent: number;
}

/** «Настенное» время пользователя: инстант сдвигаем так, чтобы UTC-поля были локальными. */
export function localWall(instant: Date, tzOffsetMinutes: number): Date {
  return new Date(instant.getTime() - tzOffsetMinutes * 60_000);
}

/** Ключ месяца 'YYYY-MM' инстанта в зоне пользователя. */
export function monthKeyForInstant(instant: Date, tzOffsetMinutes: number): string {
  return localWall(instant, tzOffsetMinutes).toISOString().slice(0, 7);
}

/** Ключи последних `count` месяцев (по возрастанию), последний — текущий месяц пользователя. */
export function lastMonthKeys(
  now: Date,
  tzOffsetMinutes: number,
  count = 6,
): string[] {
  const wall = localWall(now, tzOffsetMinutes);
  const year = wall.getUTCFullYear();
  const month = wall.getUTCMonth();
  const keys: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    keys.push(new Date(Date.UTC(year, month - i, 1)).toISOString().slice(0, 7));
  }
  return keys;
}

/** Начало ЛОКАЛЬНОГО месяца как UTC-инстант (полночь пользователя). */
export function monthStartInstant(
  monthKey: string,
  tzOffsetMinutes: number,
): Date {
  const [year, month] = monthKey.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, 1) + tzOffsetMinutes * 60_000);
}

/** Ключ следующего месяца — правая граница окна (не включая). */
export function nextMonthKey(monthKey: string): string {
  const [year, month] = monthKey.split('-').map(Number);
  return new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 7);
}
