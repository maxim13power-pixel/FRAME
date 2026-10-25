// backend/src/materials/fix-window.spec.ts
// ⭐ №174: окно фиксации — в будущее нельзя, назад «сегодня + 3 предыдущих дня».
import {
  FIX_WINDOW_DAYS,
  isFixDateAllowed,
  isValidDateKey,
  normalizeTzOffset,
  resolveFixInstant,
  shiftDateKey,
  wallDateKey,
} from './fix-window';

// Самара (UTC+4): Date#getTimezoneOffset() = −240
const SAMARA = -240;
// UTC−12: getTimezoneOffset() = +720
const MINUS_12 = 720;

describe('fix-window — окно фиксации (№174)', () => {
  it('ключ дня считается по календарю устройства, а не UTC', () => {
    // 25.10.2026 23:30 UTC = 26.10 03:30 в Самаре
    const instant = new Date('2026-10-25T23:30:00.000Z');
    expect(wallDateKey(instant, SAMARA)).toBe('2026-10-26');
    expect(wallDateKey(instant, 0)).toBe('2026-10-25');
    // 25.10 10:00 UTC = 24.10 22:00 в UTC−12
    expect(wallDateKey(new Date('2026-10-25T10:00:00.000Z'), MINUS_12)).toBe(
      '2026-10-24',
    );
  });

  it('сдвиг ключа дня работает через границу месяца и года', () => {
    expect(shiftDateKey('2026-10-02', -3)).toBe('2026-09-29');
    expect(shiftDateKey('2027-01-01', -1)).toBe('2026-12-31');
    expect(shiftDateKey('2026-02-28', 1)).toBe('2026-03-01');
  });

  it('валидация ключа даты отсекает мусор и несуществующие дни', () => {
    expect(isValidDateKey('2026-10-25')).toBe(true);
    expect(isValidDateKey('2026-02-30')).toBe(false);
    expect(isValidDateKey('25.10.2026')).toBe(false);
    expect(isValidDateKey('')).toBe(false);
  });

  it('будущее запрещено при любой зоне', () => {
    const now = new Date('2026-10-25T10:00:00.000Z'); // 14:00 Самара
    expect(isFixDateAllowed('2026-10-26', now, SAMARA)).toBe(false);
    expect(isFixDateAllowed('2026-10-25', now, SAMARA)).toBe(true);
  });

  it('назад доступно ровно 3 календарных дня', () => {
    const now = new Date('2026-10-26T05:00:00.000Z'); // понедельник 09:00 Самара
    expect(FIX_WINDOW_DAYS).toBe(3);
    expect(isFixDateAllowed('2026-10-23', now, SAMARA)).toBe(true); // пятница
    expect(isFixDateAllowed('2026-10-22', now, SAMARA)).toBe(false); // четверг — уже нет
  });

  it('«пятница, записанная в понедельник» проходит по календарю устройства', () => {
    // Понедельник 26.10 22:00 в Самаре = 18:00 UTC — по часам это уже >72ч от пятницы
    const now = new Date('2026-10-26T18:00:00.000Z');
    expect(wallDateKey(now, SAMARA)).toBe('2026-10-26');
    expect(isFixDateAllowed('2026-10-23', now, SAMARA)).toBe(true);
  });

  it('в западной зоне (UTC−12) окно тоже по локальному календарю', () => {
    const now = new Date('2026-10-25T20:00:00.000Z'); // 25.10 08:00 в UTC−12
    expect(isFixDateAllowed('2026-10-25', now, MINUS_12)).toBe(true);
    expect(isFixDateAllowed('2026-10-22', now, MINUS_12)).toBe(true);
    expect(isFixDateAllowed('2026-10-21', now, MINUS_12)).toBe(false);
  });

  it('момент фиксации — 12:00 локального времени выбранного дня', () => {
    const now = new Date('2026-10-26T18:00:00.000Z');
    const instant = resolveFixInstant('2026-10-24', now, SAMARA);
    // 12:00 Самара = 08:00 UTC
    expect(instant.toISOString()).toBe('2026-10-24T08:00:00.000Z');
  });

  it('сегодняшняя дата не даёт будущего времени: берём «сейчас»', () => {
    const now = new Date('2026-10-26T05:00:00.000Z'); // 09:00 Самара, до полудня
    const instant = resolveFixInstant('2026-10-26', now, SAMARA);
    expect(instant.toISOString()).toBe(now.toISOString());
  });

  it('без даты фиксация ставится на текущий момент', () => {
    const now = new Date('2026-10-26T05:00:00.000Z');
    expect(resolveFixInstant(undefined, now, SAMARA).toISOString()).toBe(
      now.toISOString(),
    );
    expect(resolveFixInstant(null, now, SAMARA).toISOString()).toBe(
      now.toISOString(),
    );
  });

  it('битое смещение зоны не ломает расчёт — берём зону сервера', () => {
    const server = new Date().getTimezoneOffset();
    expect(normalizeTzOffset(undefined)).toBe(server);
    expect(normalizeTzOffset('abc')).toBe(server);
    expect(normalizeTzOffset(NaN)).toBe(server);
    expect(normalizeTzOffset(9999)).toBe(server); // вне диапазона реальных зон
    expect(normalizeTzOffset(SAMARA)).toBe(SAMARA);
    expect(normalizeTzOffset(330.7)).toBe(330);
  });
});
