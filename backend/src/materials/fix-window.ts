// backend/src/materials/fix-window.ts
// ⭐ №174: окно фиксации объёма.
//
// Правило владельца: фиксировать в БУДУЩЕЕ нельзя вообще, назад — только
// «сегодня + 3 предыдущих календарных дня» (в пятницу забыл → в понедельник
// пришёл и записал). Правка уже внесённой фиксации — 72 часа с момента
// ВНЕСЕНИЯ (createdAt), а не с даты работы.
//
// Календарь — устройства, а не сервера (Railway = UTC): клиент присылает
// tzOffset = Date#getTimezoneOffset() (минуты, UTC − локальное), как в №173.

/** Сколько ПРЕДЫДУЩИХ календарных дней доступно для фиксации (плюс сегодня). */
export const FIX_WINDOW_DAYS = 3;

/** Правка внесённой фиксации доступна 72 часа с момента внесения. */
export const FIX_EDIT_WINDOW_MS = 72 * 60 * 60 * 1000;

const DAY_MS = 24 * 60 * 60 * 1000;
const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Смещение зоны клиента. Битое/отсутствующее значение → зона сервера,
 * чтобы запрос никогда не падал из-за параметра.
 */
export function normalizeTzOffset(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return new Date().getTimezoneOffset();
  }
  // Диапазон реальных зон: UTC−12…UTC+14 → −720…+840.
  if (Math.abs(value) > 840) return new Date().getTimezoneOffset();
  return Math.trunc(value);
}

/** Ключ календарного дня (YYYY-MM-DD) по локальному времени клиента. */
export function wallDateKey(instant: Date, tzOffsetMinutes: number): string {
  const wall = new Date(instant.getTime() - tzOffsetMinutes * 60_000);
  return wall.toISOString().slice(0, 10);
}

/** Сдвиг ключа дня на delta суток (в календаре, без летнего времени). */
export function shiftDateKey(dateKey: string, deltaDays: number): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const shifted = new Date(Date.UTC(y, m - 1, d) + deltaDays * DAY_MS);
  return shifted.toISOString().slice(0, 10);
}

/** Валиден ли ключ даты (формат + существующая календарная дата). */
export function isValidDateKey(dateKey: string): boolean {
  if (!DATE_KEY_RE.test(dateKey)) return false;
  const [y, m, d] = dateKey.split('-').map(Number);
  const check = new Date(Date.UTC(y, m - 1, d));
  return (
    check.getUTCFullYear() === y &&
    check.getUTCMonth() === m - 1 &&
    check.getUTCDate() === d
  );
}

/** Дата фиксации в разрешённом окне: сегодня или один из 3 предыдущих дней. */
export function isFixDateAllowed(
  dateKey: string,
  now: Date,
  tzOffsetMinutes: number,
): boolean {
  const today = wallDateKey(now, tzOffsetMinutes);
  const earliest = shiftDateKey(today, -FIX_WINDOW_DAYS);
  // ISO-ключи сравнимы лексикографически = хронологически
  return dateKey >= earliest && dateKey <= today;
}

/**
 * Момент фиксации для выбранной даты: 12:00 локального времени,
 * но не позже «сейчас» (если сегодня ещё утро — берём текущий момент).
 * Без даты — текущий момент (обычная фиксация «здесь и сейчас»).
 */
export function resolveFixInstant(
  dateKey: string | null | undefined,
  now: Date,
  tzOffsetMinutes: number,
): Date {
  if (!dateKey) return now;
  const [y, m, d] = dateKey.split('-').map(Number);
  const noonWall = Date.UTC(y, m - 1, d, 12, 0, 0, 0);
  const instant = new Date(noonWall + tzOffsetMinutes * 60_000);
  return instant.getTime() > now.getTime() ? now : instant;
}
