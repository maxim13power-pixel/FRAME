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
  price: number;
  categoryId: number;
  category?: PriceCategoryData;
  isActive: boolean;
  kind: 'WORK' | 'MATERIAL';
  createdAt?: string;
  updatedAt?: string;
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
  kind?: 'WORK' | 'MATERIAL'
): Promise<PriceCategoryData[]> => {
  const response = await api.get('/price-list/categories/full', {
    params: kind ? { kind } : {},
  });
  return response.data.map(normalizeCategory);
};

// Создать категорию
// POST /price-list/categories
export const createCategory = async (
  data: { name: string; sortOrder?: number; kind?: 'WORK' | 'MATERIAL' }
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
  kind?: 'WORK' | 'MATERIAL'
): Promise<PriceItemData[]> => {
  const response = await api.get('/price-list/items/search', {
    params: {
      ...(search ? { search } : {}),
      ...(categoryId ? { categoryId } : {}),
      ...(kind ? { kind } : {}),
    },
  });
  return response.data.map(normalizePriceItem);
};

// Создать расценку
// POST /price-list/items
export const createPriceItem = async (
  data: {
    name: string;
    article?: string;
    unit?: string;
    price: number;
    categoryId: number;
    kind?: 'WORK' | 'MATERIAL';
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