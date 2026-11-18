// backend/src/estimate-recalc/consumption.ts
// ⭐ №318: цена материала на единицу строки сметы, когда материал продаётся упаковкой.
//
//   банка краски: 1000 ₽ за 9 кг, расход 0.2 кг на 1 м²
//   → 1000 / 9 × 0.2 = 22.22 ₽/м²  (на 90 м² уйдёт 2000 ₽)
//
// Если упаковка или расход не заданы — цена считается как раньше: ровно `price`
// (прежнее поведение, ничего не ломается).
export const round2 = (value: number): number => Math.round(value * 100) / 100;

export function materialPricePerUnit(
  itemPrice: number | string | null | undefined,
  packSize: number | string | null | undefined,
  consumption: number | string | null | undefined,
): number {
  const price = Number(itemPrice) || 0;
  const pack = Number(packSize) || 0;
  const per = Number(consumption) || 0;
  if (pack > 0 && per > 0) return round2((price / pack) * per);
  return round2(price);
}

/** Задана ли упаковка/расход так, что цену нужно считать по формуле. */
export function hasPackConsumption(
  packSize: number | string | null | undefined,
  consumption: number | string | null | undefined,
): boolean {
  return (Number(packSize) || 0) > 0 && (Number(consumption) || 0) > 0;
}
