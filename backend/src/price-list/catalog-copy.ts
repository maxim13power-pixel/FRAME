// backend/src/price-list/catalog-copy.ts
// ⭐ Копирование справочника с наценкой: цена меняется ДО округления итогов,
// отдельно для работ и материалов. Это чистая функция — её используют и
// обычное «Поделиться справочником», и копия объекта.
import { PriceKind } from '@prisma/client';
import { roundMoney } from '../estimate-recalc/recalc-plan';

export interface CatalogMarkup {
  workPercent: number;
  materialPercent: number;
}

export function normalizeMarkup(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.min(500, Math.max(-90, n));
}

/** Цена с наценкой. Отрицательная итоговая цена невозможна. */
export function markupPrice(
  price: number | string | { toString(): string },
  kind: PriceKind,
  markup: CatalogMarkup,
): number {
  const base = Number(price) || 0;
  const percent =
    kind === PriceKind.WORK ? markup.workPercent : markup.materialPercent;
  return Math.max(0, roundMoney(base * (1 + percent / 100)));
}
