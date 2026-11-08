// backend/src/analytics/analytics.query.ts
// ⭐ №226 (§72, P3-7): `?objectId=abc` раньше молча игнорировался (Number('abc') = NaN →
// фильтр не применялся) и эндпоинт отдавал ВСЕ доступные проекты. Теперь 400.
import { BadRequestException } from '@nestjs/common';

/** Разбирает `?objectId=`; отсутствие/пустая строка → undefined, мусор → 400. */
export function parseObjectIdQuery(raw: string | undefined): number | undefined {
  if (raw === undefined) return undefined;
  const value = raw.trim();
  if (value === '') return undefined;
  if (!/^\d+$/.test(value)) {
    throw new BadRequestException('objectId должен быть целым числом');
  }
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new BadRequestException('objectId должен быть положительным целым числом');
  }
  return id;
}
