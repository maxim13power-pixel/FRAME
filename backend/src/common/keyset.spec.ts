// backend/src/common/keyset.spec.ts
// ⭐ №391: keyset-пагинация — границы и защита от мусорных курсоров.
import { BadRequestException } from '@nestjs/common';
import {
  buildKeysetPage,
  encodeCursor,
  keysetWhere,
  parseCursor,
  parseLimit,
} from './keyset';

describe('keyset: parseLimit', () => {
  it('без параметра — пагинация выключена (null)', () => {
    expect(parseLimit(undefined)).toBeNull();
    expect(parseLimit(null)).toBeNull();
    expect(parseLimit('')).toBeNull();
  });

  it('принимает целое и отбрасывает дробную часть', () => {
    expect(parseLimit('7')).toBe(7);
    expect(parseLimit(7)).toBe(7);
    expect(parseLimit('7.9')).toBe(7);
  });

  it('режет слишком большой limit до максимума', () => {
    expect(parseLimit('500')).toBe(200);
    expect(parseLimit('500', 100)).toBe(100);
  });

  it('отвергает 0, отрицательные и мусор', () => {
    for (const bad of ['0', '-1', 'abc', 'Infinity']) {
      expect(() => parseLimit(bad)).toThrow(BadRequestException);
    }
  });
});

describe('keyset: cursor', () => {
  it('кодирует и разбирает без потерь', () => {
    const at = new Date('2026-11-24T10:15:30.123Z');
    const raw = encodeCursor(at, 42);
    expect(parseCursor(raw)).toEqual({ at, id: 42 });
  });

  it('без параметра — первая страница', () => {
    expect(parseCursor(undefined)).toBeNull();
    expect(parseCursor('')).toBeNull();
  });

  it('отвергает мусор вместо тихой выдачи первой страницы', () => {
    for (const bad of ['abc', '|5', '2026-11-24T10:15:30Z|', 'not-a-date|5', '2026-11-24T10:15:30Z|-3']) {
      expect(() => parseCursor(bad)).toThrow(BadRequestException);
    }
  });

  it('дата без миллисекунд и с «|» в тексте — не ломают разбор', () => {
    expect(parseCursor('2026-11-24T10:15:30Z|7')).toEqual({
      at: new Date('2026-11-24T10:15:30Z'),
      id: 7,
    });
  });
});

describe('keyset: keysetWhere', () => {
  it('без курсора условие пустое', () => {
    expect(keysetWhere(null, 'createdAt')).toEqual({});
  });

  it('сравнивает по (дата, id): строго старше или та же дата с меньшим id', () => {
    const at = new Date('2026-11-24T10:00:00Z');
    expect(keysetWhere({ at, id: 10 }, 'updatedAt')).toEqual({
      OR: [
        { updatedAt: { lt: at } },
        { updatedAt: at, id: { lt: 10 } },
      ],
    });
  });
});

describe('keyset: buildKeysetPage', () => {
  const at = (iso: string) => new Date(iso);
  const row = (id: number, iso: string) => ({ id, updatedAt: at(iso) });
  const rows = [
    row(5, '2026-11-24T12:00:00Z'),
    row(4, '2026-11-24T11:00:00Z'),
    row(3, '2026-11-24T10:00:00Z'),
  ];

  it('запас +1 → отдаёт limit записей и курсор последней отданной', () => {
    const page = buildKeysetPage(rows, 2, 10, (r) => r.updatedAt);
    expect(page.items.map((r) => r.id)).toEqual([5, 4]);
    expect(page.total).toBe(10);
    expect(page.nextCursor).toBe(encodeCursor(at('2026-11-24T11:00:00Z'), 4));
  });

  it('ровно limit без запаса → следующей страницы нет', () => {
    const page = buildKeysetPage(rows, 3, 3, (r) => r.updatedAt);
    expect(page.items).toHaveLength(3);
    expect(page.nextCursor).toBeNull();
  });

  it('пустой результат сохраняет total и не даёт курсор', () => {
    const page = buildKeysetPage([] as typeof rows, 2, 42, (r) => r.updatedAt);
    expect(page.items).toEqual([]);
    expect(page.total).toBe(42);
    expect(page.nextCursor).toBeNull();
  });

  it('одинаковые даты не теряют и не дублируют строки (tie-break по id)', () => {
    const same = [
      { id: 9, createdAt: at('2026-11-24T12:00:00Z') },
      { id: 8, createdAt: at('2026-11-24T12:00:00Z') },
      { id: 7, createdAt: at('2026-11-24T12:00:00Z') },
    ];
    const first = buildKeysetPage(same, 2, 3, (r) => r.createdAt);
    expect(first.items.map((r) => r.id)).toEqual([9, 8]);
    const cursor = parseCursor(first.nextCursor)!;
    expect(cursor).toEqual({ at: at('2026-11-24T12:00:00Z'), id: 8 });
    // вторая страница по этому курсору — только id 7
    const rest = same.filter(
      (r) => r.createdAt < cursor.at || (r.createdAt.getTime() === cursor.at.getTime() && r.id < cursor.id),
    );
    expect(rest.map((r) => r.id)).toEqual([7]);
  });
});
