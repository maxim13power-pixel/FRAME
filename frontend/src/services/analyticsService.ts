// frontend/src/services/analyticsService.ts
// ⭐ Срез 3: аналитика освоения бюджета.
import api from './api';

export interface AnalyticsSummary {
  totalBudget: number;
  totalSpent: number;
  totalWarehouseValue: number;
  overrunCount: number;
  onTrackCount: number;
  totalProjects: number;
}

export interface BudgetVsActualItem {
  projectName: string;
  budget: number;
  actual: number;
  percent: number;
  status: 'under' | 'over' | 'on-track';
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
  percent: number;
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
  const response = await api.get('/analytics/monthly-trend');
  return response.data;
};

export const fetchTopOverrun = async (): Promise<TopOverrunItem[]> => {
  const response = await api.get('/analytics/top-overrun');
  return response.data;
};
