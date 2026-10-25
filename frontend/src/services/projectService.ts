// frontend/src/services/projectService.ts
// ⭐ Шаг 99: все запросы идут через единый api-инстанс — Bearer подставляет интерцептор.
import api from './api';

export interface ProjectData {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
  objectId: number;
  note?: string | null;
  progressPercent?: number;
  totalCost?: number;
  createdAt?: string;
  updatedAt?: string;
  // ⭐ №158: привязка справочника цен — новые строки сметы берут цены из него
  catalogId?: number | null;
  catalog?: { id: number; name: string } | null;
  // ⭐ №164: действующий справочник = свой проекта → справочник объекта → нет
  effectiveCatalogId?: number | null;
  effectiveCatalogName?: string | null;
  catalogSource?: 'project' | 'object' | null;
  // ⭐ №158: сколько строк уже в смете (нужно для предупреждения при смене справочника)
  materialsCount?: number;
}

export const fetchProjectsByObject = async (objectId: number): Promise<ProjectData[]> => {
  const response = await api.get(`/projects/object/${objectId}`);
  return response.data;
};

export const createProject = async (data: Omit<ProjectData, 'id' | 'createdAt' | 'updatedAt'>) => {
  const response = await api.post('/projects', data);
  return response.data;
};

export const updateProject = async (id: number, data: Partial<Omit<ProjectData, 'id' | 'createdAt' | 'updatedAt'>>) => {
  const response = await api.patch(`/projects/${id}`, data);
  return response.data;
};

export const deleteProject = async (id: number) => {
  const response = await api.delete(`/projects/${id}`);
  return response.data;
};

// ============================================================
// ⭐ №170: пересчёт сметы по справочнику цен
// ============================================================

/** Как расценка нашлась под строку сметы (для подсказки в превью) */
export type PriceRecalcMatch =
  | 'id'
  | 'article'
  | 'name'
  | 'ambiguous'
  | 'missing';

export interface PriceRecalcSide {
  oldPrice: number;
  newPrice: number;
  match: PriceRecalcMatch;
  itemId: number | null;
  changed: boolean;
}

export type PriceRecalcReason =
  | 'ok'
  | 'same'
  | 'hasFacts'
  | 'notFound'
  | 'ambiguous';

export interface PriceRecalcRow {
  materialId: number;
  name: string;
  article: string | null;
  unit: string;
  specQuantity: number;
  totalUsed: number;
  hasFacts: boolean;
  work: PriceRecalcSide;
  material: PriceRecalcSide;
  workIssue: boolean;
  materialIssue: boolean;
  apply: boolean;
  reason: PriceRecalcReason;
  planOld: number;
  planNew: number;
}

export interface PriceRecalcSummary {
  rows: number;
  withFacts: number;
  willUpdate: number;
  unchanged: number;
  notFound: number;
  planOld: number;
  planNew: number;
  delta: number;
}

export interface PriceRecalcPreview {
  projectId: number;
  projectName: string;
  catalog: {
    id: number;
    name: string;
    source: 'project' | 'object' | 'manual';
  };
  summary: PriceRecalcSummary;
  rows: PriceRecalcRow[];
}

export interface PriceRecalcApplyResult {
  updated: number;
  auditId: number | null;
  catalog: {
    id: number;
    name: string;
    source: 'project' | 'object' | 'manual';
  };
  summary: PriceRecalcSummary;
  message: string;
}

export interface PriceRecalcVersion {
  id: number;
  action: 'price_recalc' | 'price_recalc_rollback';
  createdAt: string;
  actor?: { id: number; fullName?: string | null; email?: string | null };
  catalogId: number | null;
  catalogName: string | null;
  updated: number | null;
  restored: number | null;
  rows: number;
  planOld: number | null;
  planNew: number | null;
  delta: number | null;
  sourceAuditId: number | null;
}

export const fetchPriceRecalcPreview = async (
  projectId: number,
  catalogId?: number | null,
): Promise<PriceRecalcPreview> => {
  const response = await api.get(`/projects/${projectId}/price-recalc/preview`, {
    params: catalogId ? { catalogId } : undefined,
  });
  return response.data;
};

export const applyPriceRecalc = async (
  projectId: number,
  catalogId?: number | null,
): Promise<PriceRecalcApplyResult> => {
  const response = await api.post(
    `/projects/${projectId}/price-recalc`,
    catalogId ? { catalogId } : {},
  );
  return response.data;
};

export const fetchPriceRecalcHistory = async (
  projectId: number,
): Promise<PriceRecalcVersion[]> => {
  const response = await api.get(`/projects/${projectId}/price-recalc/history`);
  return response.data;
};

export const rollbackPriceRecalc = async (
  projectId: number,
  auditId: number,
): Promise<{ restored: number; auditId: number; message: string }> => {
  const response = await api.post(
    `/projects/${projectId}/price-recalc/${auditId}/rollback`,
  );
  return response.data;
};
