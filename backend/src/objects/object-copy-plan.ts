// backend/src/objects/object-copy-plan.ts
// ⭐ Планировщик цен для копии объекта.
//
// Отличие от обычного пересчёта сметы (recalc-plan):
//  • пересчитываются ВСЕ строки, включая строки с фактическим расходом —
//    копия создаётся по выбранным ценам осознанно;
//  • при копии справочника известна карта «старый ID → новый ID», поэтому
//    связанные строки сопоставляются точно, а не по названию;
//  • ссылки на расценки в новой смете всегда указывают в ЦЕЛЕВОЙ справочник.
import { Unit } from '@prisma/client';
import {
  buildPriceIndex,
  RecalcMatchKind,
  RecalcPriceRef,
  resolvePriceRef,
  roundMoney,
} from '../estimate-recalc/recalc-plan';

export interface CopyPriceRow {
  id: number;
  name: string;
  article: string | null;
  unit: Unit;
  specQuantity: number;
  totalUsed: number;
  priceItemId: number | null;
  unitPrice: number;
  materialItemId: number | null;
  materialUnitPrice: number;
}

export interface CopyPriceSide {
  oldPrice: number;
  newPrice: number;
  match: RecalcMatchKind;
  oldItemId: number | null;
  /** id расценки в целевом справочнике (null — не нашли / неоднозначно) */
  itemId: number | null;
  /** нужно ли обновить цену или ссылку */
  changed: boolean;
  /** есть цена/ссылка, но расценка не нашлась — это ошибка соответствия */
  issue: boolean;
}

export interface CopyPriceIssue {
  materialId: number;
  name: string;
  side: 'work' | 'material';
  reason: 'missing' | 'ambiguous';
}

export interface CopyPricePlanRow {
  materialId: number;
  name: string;
  article: string | null;
  unit: Unit;
  specQuantity: number;
  totalUsed: number;
  hasFacts: boolean;
  work: CopyPriceSide;
  material: CopyPriceSide;
  issue: boolean;
  apply: boolean;
}

export interface CopyPriceSummary {
  rows: number;
  matchedRows: number;
  unmatchedRows: number;
  workUnmatched: number;
  materialUnmatched: number;
  priceChanges: number;
  factsRows: number;
}

export interface CopyPricePlan {
  rows: CopyPricePlanRow[];
  issues: CopyPriceIssue[];
  summary: CopyPriceSummary;
}

function resolveCopySide(
  oldPrice: number,
  oldItemId: number | null,
  name: string,
  article: string | null,
  unit: Unit,
  index: ReturnType<typeof buildPriceIndex>,
  idMap?: Map<number, number>,
  sourceRefs?: Map<number, RecalcPriceRef>,
): CopyPriceSide {
  const mappedId =
    oldItemId != null && idMap ? (idMap.get(oldItemId) ?? null) : oldItemId;
  let { match, item } = resolvePriceRef(mappedId, name, article, unit, index);

  // ⭐ Строка сметы хранит ОДНО название/артикул, а работа и материал в
  // справочнике могут называться по-разному. Если по строке не нашли —
  // пробуем по исходной расценке, на которую была ссылка.
  if (!item && oldItemId != null && sourceRefs) {
    const source = sourceRefs.get(oldItemId);
    if (source) {
      const bySource = resolvePriceRef(
        null,
        source.name,
        source.article,
        source.unit,
        index,
      );
      if (bySource.item) {
        match = bySource.match;
        item = bySource.item;
      }
    }
  }

  const before = roundMoney(oldPrice);
  const after = item ? roundMoney(item.price) : before;
  const hadValue = oldItemId != null || before > 0;
  const ambiguous = match === 'ambiguous' && hadValue;
  const missing = match === 'missing' && hadValue;
  return {
    oldPrice: before,
    newPrice: after,
    match,
    oldItemId,
    itemId: item ? item.id : null,
    changed:
      item != null &&
      (Math.abs(after - before) >= 0.01 || item.id !== oldItemId),
    issue: ambiguous || missing,
  };
}

/**
 * План цен для копии. Строки с фактом НЕ пропускаются: если пользователь
 * выбрал пересчёт, цена меняется и у них (решение владельца).
 */
export function buildObjectCopyPlan(
  rows: CopyPriceRow[],
  works: RecalcPriceRef[],
  materials: RecalcPriceRef[],
  idMap?: Map<number, number>,
  sourceRefs?: Map<number, RecalcPriceRef>,
): CopyPricePlan {
  const workIndex = buildPriceIndex(works);
  const materialIndex = buildPriceIndex(materials);

  const planRows = rows.map<CopyPricePlanRow>((row) => {
    const work = resolveCopySide(
      Number(row.unitPrice) || 0,
      row.priceItemId,
      row.name,
      row.article,
      row.unit,
      workIndex,
      idMap,
      sourceRefs,
    );
    const material = resolveCopySide(
      Number(row.materialUnitPrice) || 0,
      row.materialItemId,
      row.name,
      row.article,
      row.unit,
      materialIndex,
      idMap,
      sourceRefs,
    );
    return {
      materialId: row.id,
      name: row.name,
      article: row.article,
      unit: row.unit,
      specQuantity: Number(row.specQuantity) || 0,
      totalUsed: Number(row.totalUsed) || 0,
      hasFacts: Number(row.totalUsed) > 0,
      work,
      material,
      issue: work.issue || material.issue,
      apply: work.changed || material.changed,
    };
  });

  const issues: CopyPriceIssue[] = [];
  for (const row of planRows) {
    if (row.work.issue) {
      issues.push({
        materialId: row.materialId,
        name: row.name,
        side: 'work',
        reason: row.work.match === 'ambiguous' ? 'ambiguous' : 'missing',
      });
    }
    if (row.material.issue) {
      issues.push({
        materialId: row.materialId,
        name: row.name,
        side: 'material',
        reason: row.material.match === 'ambiguous' ? 'ambiguous' : 'missing',
      });
    }
  }

  const unmatchedRows = planRows.filter((r) => r.issue).length;
  return {
    rows: planRows,
    issues,
    summary: {
      rows: planRows.length,
      matchedRows: planRows.length - unmatchedRows,
      unmatchedRows,
      workUnmatched: planRows.filter((r) => r.work.issue).length,
      materialUnmatched: planRows.filter((r) => r.material.issue).length,
      priceChanges: planRows.filter((r) => r.apply).length,
      factsRows: planRows.filter((r) => r.hasFacts).length,
    },
  };
}
