// frontend/src/services/dashboardService.ts
// ⭐ Шаг 99: все запросы идут через единый api-инстанс — Bearer подставляет интерцептор.
import api from './api';

export interface DashboardSummary {
  kpi: {
    objectsCount: number;
    projectsCount: number;
    materialsCount: number;
    /** ⭐ №173: фиксаций за текущую неделю Пн→Вс (= сумма weekChart) */
    fixesWeekCount: number;
  };
  /** ⭐ №225: объёмы (прогресс работ) — отдельно от денег */
  volume: {
    /** Σ totalUsed — объёмы, не рубли */
    used: number;
    /** Σ specQuantity */
    specQuantity: number;
    /** Доля выполнения 0..1+ (может быть больше 1) */
    percent: number;
    /** На сколько процентов объём перевыполнен; null — нет */
    overrunPercent: number | null;
  };
  money: {
    estimate: number;
    actual: number;
    /** Факт − смета */
    difference: number;
    /** Факт от сметы, %; null — смета 0 */
    percentOfEstimate: number | null;
    /** Факт больше сметы */
    overBudget: boolean;
    /** На сколько % факт больше сметы; null — нет перерасхода или смета 0 */
    overPercent: number | null;
  };
  /** ⭐ №169: сколько демо-объектов попало в расчёты (0 = цифры точные) */
  demoObjects: number;
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
      project: { id: number; name: string; objectId: number };
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
  // ⭐ №173: отдаём смещение зоны браузера (Date#getTimezoneOffset: минуты,
  // UTC − локальное), чтобы «Неделя прораба» считалась по локальным суткам,
  // а не по UTC сервера.
  const response = await api.get('/dashboard/summary', {
    params: { tzOffset: new Date().getTimezoneOffset() },
  });
  return response.data;
};

/**
 * ⭐ №231: полный список «Без расценки» (в сводке приходят только 5 позиций).
 * limit зажимается на бэкенде в 1..200.
 */
export const fetchNoPriceItems = async (
  limit = 200,
): Promise<DashboardSummary['noPrice']> => {
  const response = await api.get('/dashboard/no-price', { params: { limit } });
  return response.data;
};