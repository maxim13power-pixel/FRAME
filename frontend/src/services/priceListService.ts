// frontend/src/services/priceListService.ts
// ⭐ Шаг 99: все запросы идут через единый api-инстанс — Bearer подставляет интерцептор.
// ⭐ Шаг 103 (P1-3): цена расценки хранится в DECIMAL и приходит СТРОКОЙ —
// на границе API приводим к number (normalizePriceItem / normalizeCategory).
import api from './api';
import { parseDecimal } from '../utils/decimal';

// ============================================================
// ТИПЫ ДАННЫХ (соответствуют моделям Prisma: PriceCategory, PriceItem)
// ============================================================
export interface PriceCategoryData {
  id: number;
  name: string;
  sortOrder: number;
  kind: 'WORK' | 'MATERIAL';
  items?: PriceItemData[];
}

export interface PriceItemData {
  id: number;
  name: string;
  article?: string | null;
  unit: string;
  price: number | null;
  categoryId: number;
  catalogId?: number;
  category?: PriceCategoryData;
  isActive: boolean;
  kind: 'WORK' | 'MATERIAL';
  /** ⭐ №318: «в упаковке N единиц» (кг/л/шт); цена — за упаковку */
  packSize?: number | null;
  /** ⭐ №275: черновик импорта — единица не уточнена, выбирать нельзя */
  needsClarification?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

// ⭐ №151/№164: справочник цен (несколько независимых наборов расценок)
export interface PriceCatalogData {
  id: number;
  name: string;
  ownerId: number | null;
  isSystem: boolean;
  itemsCount: number;
  projectsCount: number;
  // ⭐ №164: область справочника и права
  scope?: 'system' | 'object' | 'project' | 'personal';
  // ⭐ №274: «моя рабочая база» (одна на пользователя) и вид справочника
  isDefault?: boolean;
  kind?: 'SYSTEM' | 'USER';
  objectId?: number | null;
  objectName?: string | null;
  projectId?: number | null;
  projectName?: string | null;
  objectsCount?: number;
  canWrite?: boolean;
  /** ⭐ №179: справочник в архиве (показывается в разделе «Архив») */
  isArchived?: boolean;
  createdAt?: string;
}

// 🔒 P1-3: Decimal (строка с бэкенда) -> number на границе API
const normalizePriceItem = (item: PriceItemData): PriceItemData => ({
  ...item,
  price: parseDecimal(item.price),
});

const normalizeCategory = (c: PriceCategoryData): PriceCategoryData => ({
  ...c,
  items: c.items ? c.items.map(normalizePriceItem) : c.items,
});

// ============================================================
// КАТЕГОРИИ
// ============================================================

// Все категории (для селектов)
export const fetchCategories = async (
  kind?: 'WORK' | 'MATERIAL'
): Promise<PriceCategoryData[]> => {
  const response = await api.get('/price-list/categories', {
    params: kind ? { kind } : {},
  });
  return response.data.map(normalizeCategory);
};

// Категории вместе с активными расценками (для страницы справочника)
// GET /price-list/categories/full
export const fetchCategoriesWithItems = async (
  kind?: 'WORK' | 'MATERIAL',
  catalogId?: number
): Promise<PriceCategoryData[]> => {
  const response = await api.get('/price-list/categories/full', {
    params: {
      ...(kind ? { kind } : {}),
      ...(catalogId ? { catalogId } : {}),
    },
  });
  return response.data.map(normalizeCategory);
};

// Создать категорию
// POST /price-list/categories
export const createCategory = async (
  data: { name: string; sortOrder?: number; kind?: 'WORK' | 'MATERIAL'; catalogId?: number }
): Promise<PriceCategoryData> => {
  const response = await api.post('/price-list/categories', data);
  return response.data;
};

// Переименовать категорию
// PATCH /price-list/categories/:id
export const updateCategory = async (
  id: number,
  data: { name: string }
): Promise<PriceCategoryData> => {
  const response = await api.patch(`/price-list/categories/${id}`, data);
  return response.data;
};

// Удалить категорию (бэкенд пропустит ТОЛЬКО пустую — двойная защита)
// DELETE /price-list/categories/:id
export const deleteCategory = async (
  id: number
): Promise<PriceCategoryData> => {
  const response = await api.delete(`/price-list/categories/${id}`);
  return response.data;
};
// ============================================================
// РАСЦЕНКИ (PriceItem)
// ============================================================

// Поиск расценок (для Autocomplete в материалах и для фильтра на странице справочника)
// GET /price-list/items/search?search=&categoryId=
export const searchPriceItems = async (
  search?: string,
  categoryId?: number,
  kind?: 'WORK' | 'MATERIAL',
  catalogId?: number
): Promise<PriceItemData[]> => {
  const response = await api.get('/price-list/items/search', {
    params: {
      ...(search ? { search } : {}),
      ...(categoryId ? { categoryId } : {}),
      ...(kind ? { kind } : {}),
      ...(catalogId ? { catalogId } : {}),
    },
  });
  return response.data.map(normalizePriceItem);
};

// ⭐ №392: страница поиска с total/hasMore — для «Показано X из Y» и «Показать ещё».
// Без `limit` сервер отвечает массивом (старый контракт) — оборачиваем его.
export type PriceSearchPage = {
  items: PriceItemData[];
  total: number;
  hasMore: boolean;
};

export const searchPriceItemsPage = async (params: {
  search?: string;
  categoryId?: number;
  kind?: 'WORK' | 'MATERIAL';
  catalogId?: number;
  limit?: number;
  offset?: number;
}): Promise<PriceSearchPage> => {
  const response = await api.get('/price-list/items/search', {
    params: {
      ...(params.search ? { search: params.search } : {}),
      ...(params.categoryId ? { categoryId: params.categoryId } : {}),
      ...(params.kind ? { kind: params.kind } : {}),
      ...(params.catalogId ? { catalogId: params.catalogId } : {}),
      ...(params.limit ? { limit: params.limit } : {}),
      ...(params.offset ? { offset: params.offset } : {}),
    },
  });
  const data = response.data;
  if (Array.isArray(data)) {
    const items = data.map(normalizePriceItem);
    return { items, total: items.length, hasMore: false };
  }
  return {
    items: (data?.items ?? []).map(normalizePriceItem),
    total: typeof data?.total === 'number' ? data.total : 0,
    hasMore: data?.hasMore === true,
  };
};

// Создать расценку
// POST /price-list/items
export const createPriceItem = async (
  data: {
    name: string;
    article?: string;
    unit?: string;
    price: number;
    /** ⭐ №318: объём упаковки (кг/л/шт), необязательно */
    packSize?: number | null;
    categoryId: number;
    kind?: 'WORK' | 'MATERIAL';
    catalogId?: number;
  }
): Promise<PriceItemData> => {
  const response = await api.post('/price-list/items', data);
  return normalizePriceItem(response.data);
};

// Обновить расценку
// PATCH /price-list/items/:id
export const updatePriceItem = async (
  id: number,
  data: Partial<{
    name: string;
    article: string;
    unit: string;
    price: number;
    /** ⭐ №318: null — цена снова «за единицу измерения» */
    packSize: number | null;
  }>
): Promise<PriceItemData> => {
  const response = await api.patch(`/price-list/items/${id}`, data);
  return normalizePriceItem(response.data);
};

// «Удалить» расценку (на самом деле бэкенд делает isActive: false —
// старые сметы остаются нетронутыми, см. price-list.service.ts → removeItem)
// DELETE /price-list/items/:id
export const deletePriceItem = async (
  id: number
): Promise<PriceItemData> => {
  const response = await api.delete(`/price-list/items/${id}`);
  return normalizePriceItem(response.data);
};

// ============================================================
// ⭐ №151: СПРАВОЧНИКИ ЦЕН
// ============================================================

// Доступные справочники (системные + свои + объектные/проектные) со счётчиками.
// ⭐ №179: includeArchived — для экрана «Архив» (по умолчанию только активные)
export const fetchPriceCatalogs = async (
  opts: { includeArchived?: boolean } = {},
): Promise<PriceCatalogData[]> => {
  const response = await api.get('/price-list/catalogs', {
    params: opts.includeArchived ? { includeArchived: 1 } : undefined,
  });
  return response.data;
};

/** ⭐ №179: вернуть справочник из архива */
export const restorePriceCatalog = async (id: number): Promise<PriceCatalogData> => {
  const response = await api.post(`/price-list/catalogs/${id}/restore`);
  return response.data;
};

// ⭐ №164: создать справочник; objectId/projectId — сразу привязать к объекту/проекту
export const createPriceCatalog = async (
  name: string,
  opts?: { objectId?: number; projectId?: number }
): Promise<PriceCatalogData> => {
  const response = await api.post('/price-list/catalogs', { name, ...opts });
  return response.data;
};

// ⭐ №164: «поделиться» = скопировать расценки в справочник объекта/проекта
export const copyPriceCatalog = async (
  id: number,
  data: {
    name?: string;
    objectId?: number;
    projectId?: number;
    workMarkupPercent?: number;
    materialMarkupPercent?: number;
  }
): Promise<PriceCatalogData> => {
  const response = await api.post(`/price-list/catalogs/${id}/copy`, data);
  return response.data;
};

export const renamePriceCatalog = async (
  id: number,
  name: string
): Promise<PriceCatalogData> => {
  const response = await api.patch(`/price-list/catalogs/${id}`, { name });
  return response.data;
};

// Архивирование (данные не удаляем — история смет сохраняется)
export const archivePriceCatalog = async (id: number): Promise<PriceCatalogData> => {
  const response = await api.delete(`/price-list/catalogs/${id}`);
  return response.data;
};

// ⭐ №361: удалить справочник НАВСЕГДА (бэкенд разрешает только свободный — без объекта/проекта)
export const deletePriceCatalogPermanently = async (
  id: number,
): Promise<{ success: boolean; itemsRemoved: number }> => {
  const response = await api.delete(`/price-list/catalogs/${id}/permanent`);
  return response.data;
};

// ============================================================
// ⭐ №273 (§121): ИМПОРТ И ВЫГРУЗКА ПРАЙСА
// ============================================================

export type PriceImportKind = 'WORK' | 'MATERIAL';

export interface PriceImportRow {
  key: string;
  sheet: string;
  row: number;
  id: number | null;
  name: string;
  article: string | null;
  unitRaw: string | null;
  unit: string | null;
  unitApprox: boolean;
  price: number | null;
  note: string | null;
  category: string;
  action: 'create' | 'update' | 'unchanged';
  matchedBy: 'id' | 'article' | 'name' | null;
  needsUnit: boolean;
  changes: string[];
  warnings: string[];
}

export interface PriceUnitGroup {
  raw: string;
  key: string;
  count: number;
  suggestion: string | null;
  approx: boolean;
}

export interface PriceImportPreview {
  fileName: string | null;
  kind: PriceImportKind;
  catalog: { id: number; name: string };
  template: boolean;
  sheets: {
    sheet: string;
    category: string;
    rows: number;
    newCategory: boolean;
    skipped: boolean;
  }[];
  rows: PriceImportRow[];
  unitGroups: PriceUnitGroup[];
  stats: {
    total: number;
    create: number;
    update: number;
    unchanged: number;
    needsUnit: number;
    warnings: number;
  };
  warnings: string[];
}

export interface PriceImportResult {
  created: number;
  updated: number;
  unchanged: number;
  drafts: number;
  categoriesCreated: number;
  message: string;
}

export interface PriceClarificationGroup {
  raw: string;
  key: string;
  count: number;
  items: {
    id: number;
    name: string;
    price: number;
    category: string | null;
    kind: PriceImportKind;
  }[];
}

/** Скачать шаблон — он же выгрузка текущего справочника (лист = категория) */
export const downloadPriceTemplate = async (
  catalogId: number,
  kind: PriceImportKind,
  /** ⭐ №338/№339: true — шаблон с образцом (один для всех), false — выгрузка справочника */
  template = true,
): Promise<void> => {
  const response = await api.get(`/price-list/catalogs/${catalogId}/export`, {
    params: { kind, ...(template ? { template: 1 } : {}) },
    responseType: 'blob',
  });
  const disposition = String(response.headers['content-disposition'] ?? '');
  const match = /filename\*=UTF-8''([^;]+)/i.exec(disposition);
  const fileName = match
    ? decodeURIComponent(match[1])
    : `${template ? 'Шаблон прайса' : 'Прайс'} — ${
        kind === 'WORK' ? 'работы' : 'материалы'
      }.xlsx`;

  const blob = new Blob([response.data], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => window.URL.revokeObjectURL(url), 1000);
};

const priceImportForm = (
  kind: PriceImportKind,
  file: File,
  units: Record<string, string>,
): FormData => {
  const form = new FormData();
  form.append('kind', kind);
  form.append('file', file);
  form.append('units', JSON.stringify(units));
  return form;
};

export const previewPriceImport = async (
  catalogId: number,
  kind: PriceImportKind,
  file: File,
  units: Record<string, string> = {},
): Promise<PriceImportPreview> => {
  const response = await api.post(
    `/price-list/catalogs/${catalogId}/import/preview`,
    priceImportForm(kind, file, units),
  );
  return response.data;
};

export const commitPriceImport = async (
  catalogId: number,
  kind: PriceImportKind,
  file: File,
  units: Record<string, string> = {},
): Promise<PriceImportResult> => {
  const response = await api.post(
    `/price-list/catalogs/${catalogId}/import/commit`,
    priceImportForm(kind, file, units),
  );
  return response.data;
};

/** Черновики: единица не распознана (позиции сохранены, но неактивны) */
export const fetchPriceClarifications = async (
  catalogId: number,
  kind?: PriceImportKind,
): Promise<{ total: number; groups: PriceClarificationGroup[] }> => {
  const response = await api.get(`/price-list/catalogs/${catalogId}/clarifications`, {
    params: kind ? { kind } : undefined,
  });
  return response.data;
};

export const resolvePriceClarifications = async (
  catalogId: number,
  payload: { raw?: string; ids?: number[]; unit: string },
): Promise<{ updated: number }> => {
  const response = await api.post(`/price-list/catalogs/${catalogId}/clarifications`, payload);
  return response.data;
};

// ============================================================
// ⭐ №278 (§122): «Обновить из образца»
// ============================================================

export interface TemplateUpdateRow {
  templateItemId: number;
  itemId: number | null;
  action: 'add' | 'price';
  name: string;
  unit: string;
  kind: PriceImportKind;
  oldPrice: number | null;
  newPrice: number;
}

export interface TemplateUpdatePreview {
  available: boolean;
  catalog: {
    id: number;
    name: string;
    ownerId: number | null;
    templateId: number | null;
    templateVersion: number | null;
  };
  template: { id: number; name: string; version: number | null };
  stats: { add: number; price: number };
  rows: TemplateUpdateRow[];
}

export interface TemplateUpdateResult {
  added: number;
  updatedPrices: number;
  templateVersion: number | null;
  message: string;
}

/** Что нового в образце (ничего не меняет) */
export const fetchTemplateUpdate = async (
  catalogId: number,
): Promise<TemplateUpdatePreview> => {
  const response = await api.get(`/price-list/catalogs/${catalogId}/template-update`);
  return response.data;
};

/** Применить обновление: только новые позиции или ещё и цены */
export const applyTemplateUpdate = async (
  catalogId: number,
  mode: 'missing' | 'all',
): Promise<TemplateUpdateResult> => {
  const response = await api.post(`/price-list/catalogs/${catalogId}/template-update`, { mode });
  return response.data;
};


