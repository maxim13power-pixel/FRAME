// frontend/src/services/dashboardService.ts
// ⭐ Шаг 99: все запросы идут через единый api-инстанс — Bearer подставляет интерцептор.
import api from './api';

export interface DashboardSummary {
  kpi: {
    objectsCount: number;
    projectsCount: number;
    materialsCount: number;
    fixesLast7dCount: number;
  };
  money: { estimate: number; actual: number; percent: number };
  weekChart: { day: string; count: number }[];
  hotProjects: {
    id: number;
    name: string;
    endDate: string;
    objectId: number;
    objectName: string;
  }[];
  noPrice: {
    items: {
      id: number;
      name: string;
      unitPrice: number;
      materialUnitPrice: number;
      project: { id: number; name: string };
    }[];
    count: number;
  };
  recentFixes: {
    id: number;
    amount: number;
    note: string | null;
    fixedAt: string;
    material: {
      id: number;
      name: string;
      project: { id: number; name: string; object: { id: number; name: string } };
    };
  }[];
}

export const fetchDashboardSummary = async (): Promise<DashboardSummary> => {
  const response = await api.get('/dashboard/summary');
  return response.data;
};