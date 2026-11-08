// backend/src/analytics/analytics.months.spec.ts
// ⭐ №226 (§72, P3-4): границы месяца и часовой пояс в «динамике расходов».
import {
  lastMonthKeys,
  localWall,
  monthKeyForInstant,
  monthStartInstant,
  nextMonthKey,
} from './analytics.months';

const samara = -240; // UTC+04 (Date#getTimezoneOffset)
const utc = 0;

describe('monthKeyForInstant — месяц по зоне пользователя', () => {
  it('01.11 00:00 +04 (= 31.10 20:00 UTC) — это НОЯБРЬ, а не октябрь', () => {
    const instant = new Date('2026-10-31T20:00:00.000Z');
    expect(monthKeyForInstant(instant, samara)).toBe('2026-11');
    expect(monthKeyForInstant(instant, utc)).toBe('2026-10');
  });

  it('последний день месяца 23:30 +04 остаётся в своём месяце', () => {
    const instant = new Date('2026-09-30T19:30:00.000Z'); // 30.09 23:30 +04
    expect(monthKeyForInstant(instant, samara)).toBe('2026-09');
  });

  it('00:30 UTC у пользователя UTC−03 — ещё предыдущий день, но тот же месяц', () => {
    const instant = new Date('2026-11-01T00:30:00.000Z'); // 31.10 21:30 −03
    expect(monthKeyForInstant(instant, 180)).toBe('2026-10');
  });

  it('нулевое смещение = месяц по UTC', () => {
    expect(monthKeyForInstant(new Date('2026-11-30T22:00:00.000Z'), utc)).toBe('2026-11');
  });
});

describe('lastMonthKeys — окно 6 месяцев', () => {
  it('ноябрь 2026: июнь…ноябрь', () => {
    expect(lastMonthKeys(new Date('2026-11-08T12:00:00.000Z'), samara)).toEqual([
      '2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11',
    ]);
  });

  it('переход через год: январь 2026 → август 2025…январь 2026', () => {
    expect(lastMonthKeys(new Date('2026-01-05T00:00:00.000Z'), samara)).toEqual([
      '2025-08', '2025-09', '2025-10', '2025-11', '2025-12', '2026-01',
    ]);
  });

  it('поздний вечер UTC у +04 — уже следующий месяц', () => {
    const keys = lastMonthKeys(new Date('2026-11-30T22:00:00.000Z'), samara);
    expect(keys[keys.length - 1]).toBe('2026-12');
  });
});

describe('monthStartInstant — граница окна как UTC-инстант', () => {
  it('ноябрь +04 начинается 31.10 20:00 UTC', () => {
    expect(monthStartInstant('2026-11', samara).toISOString()).toBe(
      '2026-10-31T20:00:00.000Z',
    );
  });

  it('ноябрь по UTC начинается 01.11 00:00 UTC', () => {
    expect(monthStartInstant('2026-11', utc).toISOString()).toBe(
      '2026-11-01T00:00:00.000Z',
    );
  });

  it('nextMonthKey переходит через год', () => {
    expect(nextMonthKey('2026-12')).toBe('2027-01');
    expect(nextMonthKey('2026-11')).toBe('2026-12');
  });

  it('localWall сдвигает инстант на смещение', () => {
    expect(
      localWall(new Date('2026-10-31T20:00:00.000Z'), samara).toISOString(),
    ).toBe('2026-11-01T00:00:00.000Z');
  });
});
