// backend/src/analytics/analytics.query.spec.ts
// ⭐ №226 (§72, P3-7): мусор в ?objectId больше не «расширяет» выдачу до всех проектов.
import { BadRequestException } from '@nestjs/common';
import { parseObjectIdQuery } from './analytics.query';

describe('parseObjectIdQuery', () => {
  it('не передан или пустой → фильтра нет', () => {
    expect(parseObjectIdQuery(undefined)).toBeUndefined();
    expect(parseObjectIdQuery('')).toBeUndefined();
    expect(parseObjectIdQuery('   ')).toBeUndefined();
  });

  it('корректный id', () => {
    expect(parseObjectIdQuery('87')).toBe(87);
    expect(parseObjectIdQuery(' 42 ')).toBe(42);
  });

  it('мусор → 400, а не «все проекты»', () => {
    expect(() => parseObjectIdQuery('abc')).toThrow(BadRequestException);
    expect(() => parseObjectIdQuery('1.5')).toThrow(BadRequestException);
    expect(() => parseObjectIdQuery('-5')).toThrow(BadRequestException);
    expect(() => parseObjectIdQuery('0')).toThrow(BadRequestException);
    expect(() => parseObjectIdQuery('99999999999999999999')).toThrow(BadRequestException);
  });
});
