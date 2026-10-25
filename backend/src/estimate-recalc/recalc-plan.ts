// backend/src/estimate-recalc/recalc-plan.ts
// ⭐ №170: чистый планировщик пересчёта сметы по справочнику цен.
// Ничего не пишет в БД: по строкам сметы и расценкам справочника строит «было → станет».
// Превью и применение используют ОДИН план — что показали, то и записали.
//
// Правила сопоставления (по убыванию точности):
//   1) по priceItemId/materialItemId — если расценка жива и лежит в этом справочнике;
//   2) по артикулу (нормализованному) — если он есть у строки и в справочнике однозначен;
//   3) по нормализованному названию + единице измерения — если совпадение ровно одно;
//   иначе: ambiguous (несколько кандидатов) или missing (нет в справочнике).
//
// Строки с фиксациями (totalUsed > 0) НЕ трогаем: цена — договорённость на момент работ
// (решение владельца 10.1(4)), даже если в справочнике она уже другая.
import { Unit } from '@prisma/client';

export type RecalcMatchKind =
  | 'id'
  | 'article'
  | 'name'
  | 'ambiguous'
  | 'missing';

/** Расценка справочника в том виде, в котором нужна планировщику */
export interface RecalcPriceRef {
  id: number;
  name: string;
  article: string | null;
  unit: Unit;
  price: number;
}

/** Строка сметы (Material) — только поля, влияющие на пересчёт */
export interface RecalcMaterialRow {
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

export interface RecalcPriceIndex {
  byId: Map<number, RecalcPriceRef>;
  byArticle: Map<string, RecalcPriceRef[]>;
  byName: Map<string, RecalcPriceRef[]>;
}

/** Одна сторона строки: цена работы или цена материала */
export interface RecalcSide {
  oldPrice: number;
  newPrice: number;
  match: RecalcMatchKind;
  /** id расценки, которую запишем (null — ссылки нет и не нашли) */
  itemId: number | null;
  changed: boolean;
}

export type RecalcRowReason =
  | 'ok' // цену меняем
  | 'same' // расценка найдена, цена та же
  | 'hasFacts' // есть фиксации — строку не трогаем
  | 'notFound' // расценки нет в справочнике
  | 'ambiguous'; // в справочнике несколько кандидатов

export interface RecalcPlanRow {
  materialId: number;
  name: string;
  article: string | null;
  unit: Unit;
  specQuantity: number;
  totalUsed: number;
  hasFacts: boolean;
  work: RecalcSide;
  material: RecalcSide;
  /** расценка не нашлась, хотя цена у строки была — стоит показать предупреждение */
  workIssue: boolean;
  materialIssue: boolean;
  /** true — строку пишем в БД при применении */
  apply: boolean;
  reason: RecalcRowReason;
  /** Плановая стоимость строки по спецификации: было / станет */
  planOld: number;
  planNew: number;
}

export interface RecalcPlanSummary {
  rows: number;
  /** строки с фиксациями (не трогаем) */
  withFacts: number;
  /** строки, которые реально обновятся */
  willUpdate: number;
  /** расценка есть, цена уже совпадает */
  unchanged: number;
  /** нет расценки в справочнике (в т.ч. неоднозначная) — цена останется прежней */
  notFound: number;
  /** плановая стоимость сметы (по спецификации): было / станет */
  planOld: number;
  planNew: number;
  delta: number;
}

export interface RecalcPlan {
  rows: RecalcPlanRow[];
  summary: RecalcPlanSummary;
}

/** Копейки: цены в БД — Decimal(14,2) */
export function roundMoney(value: number): number {
  return Math.round((Number(value) || 0) * 100) / 100;
}

/** Нормализация для сравнения названий/артикулов: регистр, ё→е, кавычки, пробелы */
export function normalizeText(value?: string | null): string {
  return (value ?? '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[«»"'`„“”]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function nameKey(name: string, unit: Unit): string {
  return `${normalizeText(name)}|${unit}`;
}

/** Индекс расценок одного вида (работы или материалы) для быстрого поиска */
export function buildPriceIndex(items: RecalcPriceRef[]): RecalcPriceIndex {
  const index: RecalcPriceIndex = {
    byId: new Map(),
    byArticle: new Map(),
    byName: new Map(),
  };
  for (const item of items) {
    index.byId.set(item.id, item);
    const article = normalizeText(item.article);
    if (article) {
      const list = index.byArticle.get(article) ?? [];
      list.push(item);
      index.byArticle.set(article, list);
    }
    const key = nameKey(item.name, item.unit);
    const byName = index.byName.get(key) ?? [];
    byName.push(item);
    index.byName.set(key, byName);
  }
  return index;
}

/** Поиск расценки под строку сметы */
export function resolvePriceRef(
  refId: number | null,
  name: string,
  article: string | null,
  unit: Unit,
  index: RecalcPriceIndex,
): { match: RecalcMatchKind; item: RecalcPriceRef | null } {
  // 1) прямая ссылка (самый точный вариант)
  if (refId != null) {
    const byId = index.byId.get(refId);
    if (byId) return { match: 'id', item: byId };
  }
  // 2) артикул: берём, только если он однозначен
  const art = normalizeText(article);
  if (art) {
    const list = index.byArticle.get(art) ?? [];
    if (list.length === 1) return { match: 'article', item: list[0] };
    // несколько расценок с одним артикулом — пробуем уточнить по названию
  }
  // 3) название + единица
  const list = index.byName.get(nameKey(name, unit)) ?? [];
  if (list.length === 1) return { match: 'name', item: list[0] };
  if (list.length > 1) return { match: 'ambiguous', item: null };
  return { match: 'missing', item: null };
}

function buildSide(
  oldPrice: number,
  refId: number | null,
  name: string,
  article: string | null,
  unit: Unit,
  index: RecalcPriceIndex,
): RecalcSide {
  const { match, item } = resolvePriceRef(refId, name, article, unit, index);
  const before = roundMoney(oldPrice);
  const after = item ? roundMoney(item.price) : before;
  return {
    oldPrice: before,
    newPrice: after,
    match,
    itemId: item ? item.id : refId,
    changed: item != null && Math.abs(after - before) >= 0.01,
  };
}

/**
 * План пересчёта: строки сметы × расценки справочника (работы и материалы отдельно —
 * цена работы не должна подхватываться из материалов и наоборот).
 */
export function buildRecalcPlan(
  rows: RecalcMaterialRow[],
  works: RecalcPriceRef[],
  materials: RecalcPriceRef[],
): RecalcPlan {
  const workIndex = buildPriceIndex(works);
  const materialIndex = buildPriceIndex(materials);

  const planRows = rows.map<RecalcPlanRow>((row) => {
    const specQuantity = Number(row.specQuantity) || 0;
    const totalUsed = Number(row.totalUsed) || 0;
    const hasFacts = totalUsed > 0;

    const work = buildSide(
      Number(row.unitPrice) || 0,
      row.priceItemId,
      row.name,
      row.article,
      row.unit,
      workIndex,
    );
    const material = buildSide(
      Number(row.materialUnitPrice) || 0,
      row.materialItemId,
      row.name,
      row.article,
      row.unit,
      materialIndex,
    );

    const changed = work.changed || material.changed;
    const ambiguous =
      work.match === 'ambiguous' || material.match === 'ambiguous';
    // «Не нашли» — это проблема только если цена у строки была или ссылка битая.
    // Строка без цены материала (0) и без ссылки — это норма, не предупреждение.
    const workIssue =
      work.match === 'ambiguous' ||
      (work.match === 'missing' && work.oldPrice > 0);
    const materialIssue =
      material.match === 'ambiguous' ||
      (material.match === 'missing' && material.oldPrice > 0);

    const apply = !hasFacts && changed;

    let reason: RecalcRowReason = 'same';
    if (hasFacts) reason = 'hasFacts';
    else if (ambiguous) reason = 'ambiguous';
    else if (changed) reason = 'ok';
    else if (workIssue || materialIssue) reason = 'notFound';

    const planOld = roundMoney(
      specQuantity * (work.oldPrice + material.oldPrice),
    );
    const planNew = roundMoney(
      specQuantity *
        ((apply ? work.newPrice : work.oldPrice) +
          (apply ? material.newPrice : material.oldPrice)),
    );

    return {
      materialId: row.id,
      name: row.name,
      article: row.article,
      unit: row.unit,
      specQuantity,
      totalUsed,
      hasFacts,
      work,
      material,
      workIssue,
      materialIssue,
      apply,
      reason,
      planOld,
      planNew,
    };
  });

  const sum = (pick: (r: RecalcPlanRow) => number) =>
    roundMoney(planRows.reduce((acc, r) => acc + pick(r), 0));

  const planOld = sum((r) => r.planOld);
  const planNew = sum((r) => r.planNew);

  return {
    rows: planRows,
    summary: {
      rows: planRows.length,
      withFacts: planRows.filter((r) => r.hasFacts).length,
      willUpdate: planRows.filter((r) => r.apply).length,
      unchanged: planRows.filter((r) => !r.hasFacts && r.reason === 'same')
        .length,
      notFound: planRows.filter(
        (r) => !r.hasFacts && (r.workIssue || r.materialIssue),
      ).length,
      planOld,
      planNew,
      delta: roundMoney(planNew - planOld),
    },
  };
}
