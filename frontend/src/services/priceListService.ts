import axios from 'axios';

const API_URL = 'http://localhost:3000/price-list';

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

// ============================================================
// КАТЕГОРИИ
// ============================================================

// Все категории (для селектов)
export const fetchCategories = async (
  token: string,
  kind?: 'WORK' | 'MATERIAL'
): Promise<PriceCategoryData[]> => {
  const response = await axios.get(`${API_URL}/categories`, {
    headers: { Authorization: `Bearer ${token}` },
    params: kind ? { kind } : {},
  });
  return response.data;
};

// Категории вместе с активными расценками (для страницы справочника)
// GET /price-list/categories/full
export const fetchCategoriesWithItems = async (
  token: string,
  kind?: 'WORK' | 'MATERIAL'
): Promise<PriceCategoryData[]> => {
  const response = await axios.get(`${API_URL}/categories/full`, {
    headers: { Authorization: `Bearer ${token}` },
    params: kind ? { kind } : {},
  });
  return response.data;
};

// Создать категорию
// POST /price-list/categories
export const createCategory = async (
  token: string,
  data: { name: string; sortOrder?: number }
): Promise<PriceCategoryData> => {
  const response = await axios.post(`${API_URL}/categories`, data, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
};

// Переименовать категорию
// PATCH /price-list/categories/:id
export const updateCategory = async (
  token: string,
  id: number,
  data: { name: string }
): Promise<PriceCategoryData> => {
  const response = await axios.patch(`${API_URL}/categories/${id}`, data, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
};

// Удалить категорию (бэкенд пропустит ТОЛЬКО пустую — двойная защита)
// DELETE /price-list/categories/:id
export const deleteCategory = async (
  token: string,
  id: number
): Promise<PriceCategoryData> => {
  const response = await axios.delete(`${API_URL}/categories/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
};
// ============================================================
// РАСЦЕНКИ (PriceItem)
// ============================================================

// Поиск расценок (для Autocomplete в материалах и для фильтра на странице справочника)
// GET /price-list/items/search?search=&categoryId=
export const searchPriceItems = async (
  token: string,
  search?: string,
  categoryId?: number,
  kind?: 'WORK' | 'MATERIAL'
): Promise<PriceItemData[]> => {
  const response = await axios.get(`${API_URL}/items/search`, {
    headers: { Authorization: `Bearer ${token}` },
    params: {
      ...(search ? { search } : {}),
      ...(categoryId ? { categoryId } : {}),
      ...(kind ? { kind } : {}),
    },
  });
  return response.data;
};

// Создать расценку
// POST /price-list/items
export const createPriceItem = async (
  token: string,
  data: {
    name: string;
    article?: string;
    unit?: string;
    price: number;
    categoryId: number;
    kind?: 'WORK' | 'MATERIAL';
  }
): Promise<PriceItemData> => {
  const response = await axios.post(`${API_URL}/items`, data, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
};

// Обновить расценку
// PATCH /price-list/items/:id
export const updatePriceItem = async (
  token: string,
  id: number,
  data: Partial<{
    name: string;
    article: string;
    unit: string;
    price: number;
  }>
): Promise<PriceItemData> => {
  const response = await axios.patch(`${API_URL}/items/${id}`, data, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
};

// «Удалить» расценку (на самом деле бэкенд делает isActive: false —
// старые сметы остаются нетронутыми, см. price-list.service.ts → removeItem)
// DELETE /price-list/items/:id
export const deletePriceItem = async (
  token: string,
  id: number
): Promise<PriceItemData> => {
  const response = await axios.delete(`${API_URL}/items/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
};