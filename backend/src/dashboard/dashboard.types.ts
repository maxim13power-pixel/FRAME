// backend/src/dashboard/dashboard.types.ts
// Типы ответа GET /dashboard/summary.
// TODO: orgId после мульти-тенантности — добавить фильтр orgId во все aggregate/where.

export interface DashboardKpiDto {
  objectsCount: number;
  projectsCount: number;
  materialsCount: number;
  /** Кол-во фиксаций за последние 7 дней (включая сегодня). */
  fixesLast7dCount: number;
}

export interface DashboardMoneyDto {
  /** Смета = Σ (unitPrice + materialUnitPrice) × specQuantity по всем материалам. */
  estimate: number;
  /** Факт = Σ (totalCost + materialTotalCost) по всем материалам. */
  actual: number;
  /** Процент выполнения работ = Σ totalUsed / Σ specQuantity (0..1). */
  percent: number;
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
  project: { id: number; name: string };
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
  money: DashboardMoneyDto;
  weekChart: DashboardWeekPointDto[];
  hotProjects: DashboardHotProjectDto[];
  noPrice: DashboardNoPriceDto;
  recentFixes: DashboardRecentFixDto[];
}