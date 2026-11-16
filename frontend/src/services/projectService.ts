// frontend/src/services/projectService.ts
// в­ђ РЁР°Рі 99: РІСЃРµ Р·Р°РїСЂРѕСЃС‹ РёРґСѓС‚ С‡РµСЂРµР· РµРґРёРЅС‹Р№ api-РёРЅСЃС‚Р°РЅСЃ вЂ” Bearer РїРѕРґСЃС‚Р°РІР»СЏРµС‚ РёРЅС‚РµСЂС†РµРїС‚РѕСЂ.
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
  // в­ђ в„–158: РїСЂРёРІСЏР·РєР° СЃРїСЂР°РІРѕС‡РЅРёРєР° С†РµРЅ вЂ” РЅРѕРІС‹Рµ СЃС‚СЂРѕРєРё СЃРјРµС‚С‹ Р±РµСЂСѓС‚ С†РµРЅС‹ РёР· РЅРµРіРѕ
  catalogId?: number | null;
  catalog?: { id: number; name: string } | null;
  // в­ђ в„–164: РґРµР№СЃС‚РІСѓСЋС‰РёР№ СЃРїСЂР°РІРѕС‡РЅРёРє = СЃРІРѕР№ РїСЂРѕРµРєС‚Р° в†’ СЃРїСЂР°РІРѕС‡РЅРёРє РѕР±СЉРµРєС‚Р° в†’ РЅРµС‚
  effectiveCatalogId?: number | null;
  effectiveCatalogName?: string | null;
  catalogSource?: 'project' | 'object' | null;
  // в­ђ в„–158: СЃРєРѕР»СЊРєРѕ СЃС‚СЂРѕРє СѓР¶Рµ РІ СЃРјРµС‚Рµ (РЅСѓР¶РЅРѕ РґР»СЏ РїСЂРµРґСѓРїСЂРµР¶РґРµРЅРёСЏ РїСЂРё СЃРјРµРЅРµ СЃРїСЂР°РІРѕС‡РЅРёРєР°)
  materialsCount?: number;
  // в­ђ в„–188: РїСЂР°РІР° РЅР° РїСЂРѕРµРєС‚ вЂ” РґР»СЏ СЃРµСЂС‹С… РєРЅРѕРїРѕРє РІ РјРµРЅСЋ РґРµР№СЃС‚РІРёР№
  // (С„Р»Р°Рі revoked СѓР±СЂР°РЅ РІ в„–193: РѕС‚РѕР·РІР°РЅРЅС‹Р№ РґРѕСЃС‚СѓРї РїСЂРѕРµРєС‚ РЅРµ РїРѕР»СѓС‡Р°РµС‚ РІРѕРІСЃРµ)
  canWrite?: boolean;
  canManage?: boolean;
  // в­ђ в„–244: РєР°СЂС‚РѕС‡РєР° РїСЂРѕРµРєС‚Р° (РїРµСЂРµРёРјРµРЅРѕРІР°РЅРёРµ/РґР°С‚С‹/Р·Р°РјРµС‚РєР°) Рё СѓРґР°Р»РµРЅРёРµ вЂ”
  // СЌС‚Рѕ РїСЂР°РІР° РЅР° Р’Р•РЎР¬ РѕР±СЉРµРєС‚, СѓС‡Р°СЃС‚РЅРёРєСѓ РѕРґРЅРѕРіРѕ РїСЂРѕРµРєС‚Р° РѕРЅРё РЅРµ РІС‹РґР°СЋС‚СЃСЏ
  canEditCard?: boolean;
  canDeleteCard?: boolean;
  // в­ђ в„–249: Р»РёС‡РЅС‹Р№ Р°СЂС…РёРІ РїСЂРѕРµРєС‚Р° + РѕС‚Р»РѕР¶РµРЅРЅРѕРµ СѓРґР°Р»РµРЅРёРµ
  hiddenForMe?: boolean;
  deleteAfter?: string | null;
  deleteRequestedAt?: string | null;
  deleteRequestedBy?: number | null;
}

// в­ђ в„–172: opts.includeHidden вЂ” РІРµСЂРЅСѓС‚СЊ РїСЂРѕРµРєС‚С‹ РѕР±СЉРµРєС‚Р°, РґР°Р¶Рµ РµСЃР»Рё РѕРЅ РІ Р»РёС‡РЅРѕРј
// Р°СЂС…РёРІРµ (РєР°СЂС‚РѕС‡РєР° Р±СЂРёРіР°РґС‹: РІС‹Р±РѕСЂ РїСЂРѕРµРєС‚Р° РѕРіСЂР°РЅРёС‡РµРЅ РѕР±СЉРµРєС‚РѕРј Р±СЂРёРіР°РґС‹).
export const fetchProjectsByObject = async (
  objectId: number,
  opts: { includeHidden?: boolean } = {},
): Promise<ProjectData[]> => {
  const response = await api.get(`/projects/object/${objectId}`, {
    params: opts.includeHidden ? { includeHidden: 1 } : undefined,
  });
  return response.data;
};

export const createProject = async (data: Omit<ProjectData, 'id' | 'createdAt' | 'updatedAt'>) => {
  const response = await api.post('/projects', data);
  return response.data;
};

/** ⭐ №286: проект, из которого можно скопировать смету при создании нового */
export interface AvailableProject {
  id: number;
  name: string;
  objectId: number;
  objectName: string;
  materialsCount: number;
}

/** ⭐ №286: список доступных пользователю проектов (только с позициями) */
export const fetchAvailableProjects = async (): Promise<AvailableProject[]> => {
  const response = await api.get('/projects/available');
  return response.data;
};

/**
 * ⭐ №286: скопировать смету другого проекта в этот (только в пустой).
 * Переносятся позиции и цены; прогресс/факт — нет.
 * `zeroQuantities` — количества обнулить (остаются названия и единицы).
 */
export const copyEstimateFromProject = async (
  targetProjectId: number,
  payload: { sourceProjectId: number; zeroQuantities?: boolean },
): Promise<{ created: number }> => {
  const response = await api.post(`/projects/${targetProjectId}/copy-estimate`, payload);
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

/** в­ђ в„–249: Р»РёС‡РЅС‹Р№ Р°СЂС…РёРІ РїСЂРѕРµРєС‚Р° вЂ” СЃРєСЂС‹С‚СЊ/РїРѕРєР°Р·Р°С‚СЊ С‚РѕР»СЊРєРѕ Сѓ СЃРµР±СЏ. */
export const setProjectHidden = async (
  projectId: number,
  isHidden: boolean,
): Promise<{ success: boolean; isHidden: boolean; projectId: number }> => {
  const response = await api.patch(`/me/projects/${projectId}`, { isHidden });
  return response.data;
};

/** в­ђ в„–249: СѓРґР°Р»РµРЅРёРµ РїСЂРѕРµРєС‚Р° С‡РµСЂРµР· 30 РґРЅРµР№ (С‚РѕР»СЊРєРѕ Р°РґРјРёРЅ РѕР±СЉРµРєС‚Р°). */
export const scheduleProjectDeletion = async (
  projectId: number,
): Promise<{ deleteAfter: string; daysLeft: number }> => {
  const response = await api.post(`/projects/${projectId}/deletion`);
  return response.data;
};

/** в­ђ в„–249: РѕС‚РјРµРЅРёС‚СЊ Р·Р°РїР»Р°РЅРёСЂРѕРІР°РЅРЅРѕРµ СѓРґР°Р»РµРЅРёРµ РїСЂРѕРµРєС‚Р°. */
export const cancelProjectDeletion = async (
  projectId: number,
): Promise<{ cancelled: boolean }> => {
  const response = await api.delete(`/projects/${projectId}/deletion`);
  return response.data;
};

// ============================================================
// в­ђ в„–170: РїРµСЂРµСЃС‡С‘С‚ СЃРјРµС‚С‹ РїРѕ СЃРїСЂР°РІРѕС‡РЅРёРєСѓ С†РµРЅ
// ============================================================

/** РљР°Рє СЂР°СЃС†РµРЅРєР° РЅР°С€Р»Р°СЃСЊ РїРѕРґ СЃС‚СЂРѕРєСѓ СЃРјРµС‚С‹ (РґР»СЏ РїРѕРґСЃРєР°Р·РєРё РІ РїСЂРµРІСЊСЋ) */
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
    source: 'project' | 'object' | 'personal' | 'manual';
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
    source: 'project' | 'object' | 'personal' | 'manual';
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
