// backend/src/dashboard/dashboard.types.ts
// Типы ответа GET /dashboard/summary.
// TODO: orgId после мульти-тенантности — добавить фильтр orgId во все aggregate/where.

export interface DashboardKpiDto {
  objectsCount: number;
  projectsCount: number;
  materialsCount: number;
  /**
   * Кол-во фиксаций за текущую календарную неделю Пн→Вс (совпадает с суммой
   * точек `weekChart`). ⭐ №173: раньше считалось «последние 7 дней» и
   * расходилось с графиком.
   */
  fixesWeekCount: number;
}

/**
 * ⭐ №225 (§71, №118): ОБЪЁМЫ — отдельный блок.
 * Раньше этот процент лежал в `money.percent`, поэтому UI подписывал прогресс
 * объёмов как денежный перерасход («+864 % перерасход»).
 */
export interface DashboardVolumeDto {
  /** Σ totalUsed по всем доступным объектам (объёмы, не деньги). */
  used: number;
  /** Σ specQuantity по всем доступным объектам. */
  specQuantity: number;
  /** Σ totalUsed / Σ specQuantity без верхнего клампа (может быть > 1). */
  percent: number;
  /**
   * На сколько процентов объём перевыполнен (N в бейдже «объём перевыполнен на N %»).
   * null — перевыполнения нет (в том числе ровно 100 %).
   */
  overrunPercent: number | null;
}

export interface DashboardMoneyDto {
  /** Смета = Σ (unitPrice + materialUnitPrice) × specQuantity по всем материалам. */
  estimate: number;
  /** Факт = Σ (totalCost + materialTotalCost) по всем материалам. */
  actual: number;
  /**
   * @deprecated ⭐ №225: это прогресс ОБЪЁМОВ (totalUsed / specQuantity), а не деньги.
   * Оставлено для обратной совместимости; новым кодом использовать `volume.percent`,
   * для денег — `difference` / `overBudget` / `overPercent`.
   */
  percent: number;
  /** Факт − смета (отрицательное значение = экономия). */
  difference: number;
  /** Факт от сметы в процентах (1 знак); null — смета = 0 (делить нельзя). */
  percentOfEstimate: number | null;
  /** true — факт больше сметы (денежный перерасход). */
  overBudget: boolean;
  /** На сколько процентов факт больше сметы; null — перерасхода нет или смета = 0. */
  overPercent: number | null;
}

export interface DashboardWeekPointDto {
  /** ISO-дата YYYY-MM-DD. */
  day: string;
  count: number;
}

export interface DashboardHotProjectDto {
  id: number;
  name: string;
  /** ISO datetime. */
  endDate: string;
  /** ID объекта — нужен для навигации на фронте. */
  objectId: number;
  objectName: string;
}

export interface DashboardNoPriceItemDto {
  id: number;
  name: string;
  unitPrice: number;
  materialUnitPrice: number;
  /** objectId — для перехода на страницу сметы конкретного проекта (№161). */
  project: { id: number; name: string; objectId: number };
}

export interface DashboardNoPriceDto {
  items: DashboardNoPriceItemDto[];
  count: number;
}

export interface DashboardRecentFixDto {
  id: number;
  amount: number;
  note: string | null;
  /** ISO datetime. */
  fixedAt: string;
  material: {
    id: number;
    name: string;
    project: {
      id: number;
      name: string;
      object: { id: number; name: string };
    };
  };
}

export interface DashboardSummaryDto {
  kpi: DashboardKpiDto;
  /** ⭐ №169: демо-объекты в расчётах (стикер «цифры неточные») */
  demoObjects: number;
  /** ⭐ №225: объёмы (прогресс работ) — отдельно от денег. */
  volume: DashboardVolumeDto;
  money: DashboardMoneyDto;
  weekChart: DashboardWeekPointDto[];
  hotProjects: DashboardHotProjectDto[];
  noPrice: DashboardNoPriceDto;
  recentFixes: DashboardRecentFixDto[];
}
