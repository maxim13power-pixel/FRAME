// backend/src/materials/material-totals.ts
// ⭐ №380: итоги сметы считаем в SQL (groupBy), а не выгрузкой строк в JS.
// Раньше списки объектов/проектов тянули все строки материалов с четырьмя
// Decimal-полями и суммировали их в памяти — время ответа росло линейно.
import type { Prisma } from '@prisma/client';

/** Итоги по строкам сметы одного проекта. */
export type MaterialTotals = {
  /** количество позиций */
  count: number;
  /** Σ «по спецификации» */
  sumSpec: number;
  /** Σ «итого» (факт) */
  sumUsed: number;
  /** Σ (работы + материалы) на текущий момент */
  sumCost: number;
};

/** Нули для проекта без строк: groupBy не возвращает пустые группы. */
export const emptyMaterialTotals = (): MaterialTotals => ({
  count: 0,
  sumSpec: 0,
  sumUsed: 0,
  sumCost: 0,
});

type MaterialGroupRow = {
  projectId: number;
  _count: { _all: number };
  _sum: {
    specQuantity: Prisma.Decimal | null;
    totalUsed: Prisma.Decimal | null;
    totalCost: Prisma.Decimal | null;
    materialTotalCost: Prisma.Decimal | null;
  };
};

/** Prisma отдаёт Decimal — на границе приводим к number. */
const num = (value: Prisma.Decimal | null | undefined): number =>
  Number(value ?? 0);

/** Клиент или транзакция — обоим доступен material.groupBy. */
type TotalsClient = Pick<Prisma.TransactionClient, 'material'>;

export function toMaterialTotals(row?: MaterialGroupRow): MaterialTotals {
  if (!row) return emptyMaterialTotals();
  const sum = row._sum;
  return {
    count: row._count._all,
    sumSpec: num(sum.specQuantity),
    sumUsed: num(sum.totalUsed),
    // Каждое поле суммируется в SQL точно; складываем уже два числа.
    sumCost: num(sum.totalCost) + num(sum.materialTotalCost),
  };
}

/**
 * Итоги по списку проектов одним запросом.
 * Возвращает только проекты, у которых есть строки; остальным — нули
 * через `emptyMaterialTotals()` (иначе проекты «исчезают» из списка).
 */
export async function loadMaterialTotals(
  prisma: TotalsClient,
  projectIds: number[],
): Promise<Map<number, MaterialTotals>> {
  const ids = [...new Set(projectIds)].filter((id) => Number.isFinite(id));
  if (ids.length === 0) return new Map();

  const rows = await prisma.material.groupBy({
    by: ['projectId'],
    where: { projectId: { in: ids } },
    _count: { _all: true },
    _sum: {
      specQuantity: true,
      totalUsed: true,
      totalCost: true,
      materialTotalCost: true,
    },
  });

  const map = new Map<number, MaterialTotals>();
  for (const row of rows as unknown as MaterialGroupRow[]) {
    map.set(row.projectId, toMaterialTotals(row));
  }
  return map;
}

/** Итоги одного проекта (карточка проекта). */
export async function loadMaterialTotalsForProject(
  prisma: TotalsClient,
  projectId: number,
): Promise<MaterialTotals> {
  const map = await loadMaterialTotals(prisma, [projectId]);
  return map.get(projectId) ?? emptyMaterialTotals();
}

/** Честный процент: Σ «итого» / Σ «по спецификации» × 100. */
export function materialsProgressPercent(totals: MaterialTotals): number {
  return totals.sumSpec > 0
    ? Math.round((totals.sumUsed / totals.sumSpec) * 100)
    : 0;
}
