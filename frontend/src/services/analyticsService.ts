// frontend/src/services/analyticsService.ts
// ⭐ Срез 3: аналитика освоения бюджета.
import api from './api';

export interface AnalyticsSummary {
  totalBudget: number;
  totalSpent: number;
  totalWarehouseValue: number;
  /** ⭐ №224: сколько позиций склада без цены (их стоимость не входит в totalWarehouseValue) */
  warehouseItemsWithoutPrice: number;
  /** ⭐ №226: перерасход — только проекты СО СМЕТОЙ (budget > 0 и actual > budget) */
  overrunCount: number;
  /** ⭐ №226: проекты без сметы (budget = 0) — считаются отдельно, не «перерасход 100 %» */
  noBudgetCount: number;
  onTrackCount: number;
  totalProjects: number;
  /** ⭐ №169: сколько демо-объектов попало в расчёты (0 = цифры точные) */
  demoObjects: number;
}

export interface BudgetVsActualItem {
  projectName: string;
  budget: number;
  actual: number;
  /** ⭐ №226: null, если сметы нет (делить нельзя) */
  percent: number | null;
  status: 'under' | 'over' | 'on-track' | 'no-budget';
}

export interface MonthlyTrendItem {
  month: string; // "2026-04"
  spent: number;
}

export interface TopOverrunItem {
  projectName: string;
  budget: number;
  actual: number;
  overrun: number;
  /** ⭐ №226: null, если сметы нет */
  percent: number | null;
}

export const fetchAnalyticsSummary = async (): Promise<AnalyticsSummary> => {
  const response = await api.get('/analytics/summary');
  return response.data;
};

export const fetchBudgetVsActual = async (
  objectId?: number,
): Promise<BudgetVsActualItem[]> => {
  const response = await api.get('/analytics/budget-vs-actual', {
    params: objectId ? { objectId } : {},
  });
  return response.data;
};

export const fetchMonthlyTrend = async (): Promise<MonthlyTrendItem[]> => {
  // ⭐ №226 (§72, P3-4): месяцы считаются в зоне браузера (Date#getTimezoneOffset),
  // а не в UTC сервера — иначе 1-е число месяца уезжает в предыдущий месяц.
  const response = await api.get('/analytics/monthly-trend', {
    params: { tzOffset: new Date().getTimezoneOffset() },
  });
  return response.data;
};

export const fetchTopOverrun = async (): Promise<TopOverrunItem[]> => {
  const response = await api.get('/analytics/top-overrun');
  return response.data;
};
