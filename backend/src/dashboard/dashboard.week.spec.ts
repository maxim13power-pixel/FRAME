// backend/src/dashboard/dashboard.week.spec.ts
// ⭐ №173: «Неделя прораба» — календарная неделя Пн→Вс и локальные сутки.
// Проверяем чистые хелперы: без БД и без Nest-контейнера.
import {
  addDaysWall,
  dateKeyWall,
  dayKeyForInstant,
  startOfWeekWall,
} from './dashboard.service';

const wall = (iso: string) => new Date(iso);

describe('startOfWeekWall (понедельник, Вс→6 дней назад)', () => {
  it('воскресенье относит к понедельнику той же недели', () => {
    expect(dateKeyWall(startOfWeekWall(wall('2026-10-25T00:00:00.000Z')))).toBe(
      '2026-10-19',
    );
  });

  it('понедельник остаётся собой', () => {
    expect(dateKeyWall(startOfWeekWall(wall('2026-10-19T00:00:00.000Z')))).toBe(
      '2026-10-19',
    );
  });

  it('четверг относит к прошедшему понедельнику', () => {
    expect(dateKeyWall(startOfWeekWall(wall('2026-10-22T15:30:00.000Z')))).toBe(
      '2026-10-19',
    );
  });

  it('воскресенье прошлой недели — 12 октября', () => {
    expect(dateKeyWall(startOfWeekWall(wall('2026-10-18T23:59:00.000Z')))).toBe(
      '2026-10-12',
    );
  });
});

describe('addDaysWall / dateKeyWall', () => {
  it('7 дней от понедельника — следующий понедельник (не включая)', () => {
    const start = startOfWeekWall(wall('2026-10-25T00:00:00.000Z'));
    expect(dateKeyWall(addDaysWall(start, 7))).toBe('2026-10-26');
  });

  it('6-й день недели — воскресенье', () => {
    const start = startOfWeekWall(wall('2026-10-25T00:00:00.000Z'));
    expect(dateKeyWall(addDaysWall(start, 6))).toBe('2026-10-25');
  });

  it('граница месяца', () => {
    const start = startOfWeekWall(wall('2026-11-01T00:00:00.000Z')); // Вс
    expect(dateKeyWall(start)).toBe('2026-10-26');
    expect(dateKeyWall(addDaysWall(start, 6))).toBe('2026-11-01');
  });
});

describe('dayKeyForInstant (день фиксации в зоне пользователя)', () => {
  const samara = -240 * 60_000; // UTC+04
  const utcMinus12 = 720 * 60_000;

  it('фиксация в 23:30 UTC у пользователя +04 — это следующий день', () => {
    expect(dayKeyForInstant(wall('2026-10-25T23:30:00.000Z'), samara)).toBe(
      '2026-10-26',
    );
  });

  it('фиксация в 00:30 UTC у пользователя +04 — тот же день', () => {
    expect(dayKeyForInstant(wall('2026-10-25T00:30:00.000Z'), samara)).toBe(
      '2026-10-25',
    );
  });

  it('фиксация в 08:20 UTC у пользователя UTC−12 — предыдущий день', () => {
    expect(dayKeyForInstant(wall('2026-10-25T08:20:00.000Z'), utcMinus12)).toBe(
      '2026-10-24',
    );
  });

  it('нулевое смещение = день по UTC', () => {
    expect(dayKeyForInstant(wall('2026-10-25T23:30:00.000Z'), 0)).toBe(
      '2026-10-25',
    );
  });
});
