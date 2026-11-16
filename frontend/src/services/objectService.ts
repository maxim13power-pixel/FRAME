// frontend/src/services/objectService.ts
// ⭐ Шаг 99: все запросы идут через единый api-инстанс — Bearer подставляет интерцептор.
import api from './api';

export interface ObjectData {
  id: number;
  name: string;
  address: string;
  startDate: string;
  endDate: string;
  plannedEndDate?: string;
  createdAt?: string;
  note?: string | null;
  progressPercent?: number; // честный % из проектов
  totalCost?: number;
  role?: 'CUSTOMER' | 'FOREMAN' | 'VIEWER'; // ⭐ роль пользователя на объекте
  hidePrices?: boolean; // ⭐ скрывать ли цены для этого участника
  hasObjectAccess?: boolean; // ⭐ №163: доступ на весь объект (иначе — только конкретный проект)
  projectsCount?: number; // ⭐ №163: сколько проектов объекта доступно пользователю
  catalogId?: number | null; // ⭐ №164: справочник цен объекта (наследуют проекты)
  catalog?: { id: number; name: string } | null;
  isDemo?: boolean; // ⭐ №127: демо-объект онбординга
  isArchived?: boolean; // ⚠️ №168: легаси, глобального архива больше нет
  // ⭐ №168: личный архив / управление командой
  // (флаг revoked убран в №193: отозванный доступ объект не получает вовсе)
  accessId?: number | null;
  hiddenForMe?: boolean;
  // ⭐ №207: «прораб-менеджер» упразднён; право создавать проекты — отдельный флаг
  canCreateProjects?: boolean;
  canWrite?: boolean;
  canManage?: boolean;
  /** ⭐ №207: сколько людей в команде объекта (только для админа объекта) */
  participantsCount?: number | null;
  /** ⭐ №246: запланировано безвозвратное удаление (ISO) — null/undefined = нет */
  deleteAfter?: string | null;
  deleteRequestedAt?: string | null;
  deleteRequestedBy?: number | null;
}

// Получить объекты.
// ⭐ №176: по умолчанию архивные объекты НЕ отдаём — раньше каждый селект фильтровал
// по-своему (кто-то по легаси isArchived, кто-то вообще без фильтра), из-за чего
// в «Поделиться справочником», отчётах и на складе выпадали объекты из архива.
// Кому архив нужен (главный список «Объекты», карточка бригады) — просит includeArchived.
export const fetchObjects = async (
  opts: { includeArchived?: boolean } = {},
): Promise<ObjectData[]> => {
  const response = await api.get('/objects');
  const data = response.data as ObjectData[];
  if (opts.includeArchived) return data;
  return data.filter((o) => !o.isArchived && !o.hiddenForMe);
};

// Создать объект
export const createObject = async (data: Omit<ObjectData, 'id' | 'createdAt'>) => {
  const response = await api.post('/objects', data);
  return response.data;
};

export const updateObject = async (id: number, data: Partial<Omit<ObjectData, 'id' | 'createdAt'>>) => {
  const response = await api.patch(`/objects/${id}`, data);
  return response.data;
};

// ⚠️ №168: deleteObject/restoreObject удалены — глобального архива и жёсткого
// удаления объектов больше нет. Личный архив: setMyAccessHidden (accessService).

// Получить один объект по ID
export const fetchObjectById = async (id: number): Promise<ObjectData> => {
  const response = await api.get(`/objects/${id}`);
  return response.data;
};

export const updateObjectEndDate = async (id: number, endDate: string) => {
  const response = await api.patch(`/objects/${id}/end-date`, { endDate });
  return response.data;
};

/**
 * ⭐ №246: назначить безвозвратное удаление объекта через 30 дней.
 * Доступно только администратору объекта (на бэке — 403 остальным).
 */
export const scheduleObjectDeletion = async (
  id: number,
): Promise<{ deleteAfter: string; daysLeft: number }> => {
  const response = await api.post(`/objects/${id}/deletion`);
  return response.data;
};

/** ⭐ №246: отменить запланированное удаление (любой админ объекта). */
export const cancelObjectDeletion = async (
  id: number,
): Promise<{ cancelled: boolean }> => {
  const response = await api.delete(`/objects/${id}/deletion`);
  return response.data;
};

/**
 * ⭐ №284: удалить объект окончательно и сразу (без 30-дневного ожидания).
 * Доступно только администратору объекта; участники получают личные копии без фото.
 * `copied` — сколько участников получили личные копии.
 */
export const deleteObjectPermanently = async (
  id: number,
): Promise<{ deleted: boolean; copied: number }> => {
  const response = await api.delete(`/objects/${id}`);
  return response.data;
};

// ============================================================
// ⭐ Копирование объекта
// ============================================================

export type ObjectCopyPricingMode = 'keep' | 'existing' | 'copy';

export interface ObjectCopyPayload {
  name?: string;
  address?: string;
  startDate?: string;
  endDate?: string;
  note?: string;
  projectIds?: number[];
  copyFacts?: boolean;
  pricingMode: ObjectCopyPricingMode;
  catalogId?: number;
  sourceCatalogId?: number;
  catalogName?: string;
  workMarkupPercent?: number;
  materialMarkupPercent?: number;
  strictMatch?: boolean;
}

export interface ObjectCopySummary {
  rows: number;
  matchedRows: number;
  unmatchedRows: number;
  workUnmatched: number;
  materialUnmatched: number;
  priceChanges: number;
  factsRows: number;
}

export interface ObjectCopyIssue {
  materialId: number;
  name: string;
  side: 'work' | 'material';
  reason: 'missing' | 'ambiguous';
}

export interface ObjectCopyPreview {
  pricingMode: ObjectCopyPricingMode;
  catalog: {
    id: number | null;
    name: string;
    source: 'source' | 'selected' | 'copy';
  } | null;
  summary: ObjectCopySummary;
  issueTotal: number;
  issues: ObjectCopyIssue[];
  warnings: string[];
}

export interface ObjectCopyStats {
  projects: number;
  materials: number;
  factsCopied: boolean;
  pricingMode: ObjectCopyPricingMode;
  catalogId: number | null;
  catalogName: string | null;
  summary: ObjectCopySummary | null;
  warnings: string[];
}

export type ObjectCopyResult = ObjectData & { copyStats: ObjectCopyStats };

/** Предпросмотр: сколько строк сметы сопоставилось с выбранным справочником. */
export const previewObjectCopy = async (
  id: number,
  payload: ObjectCopyPayload,
): Promise<ObjectCopyPreview> => {
  const response = await api.post(`/objects/${id}/copy/preview`, payload);
  return response.data;
};

/** Создать копию объекта. Старый объект не меняется. */
export const copyObject = async (
  id: number,
  payload: ObjectCopyPayload,
): Promise<ObjectCopyResult> => {
  const response = await api.post(`/objects/${id}/copy`, payload);
  return response.data;
};
