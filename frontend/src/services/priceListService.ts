import axios from 'axios';

const API_URL = 'http://localhost:3000/price-list';

// ============================================================
// ТИПЫ ДАННЫХ (соответствуют моделям Prisma: PriceCategory, PriceItem)
// ============================================================

export interface PriceCategoryData {
  id: number;
  name: string;
  sortOrder: number;
  items?: PriceItemData[]; // заполняется только в /categories/full
}

export interface PriceItemData {
  id: number;
  name: string;
  article?: string | null;
  unit: string; // PIECE | METER | SQUARE_METER | ...
  price: number;
  categoryId: number;
  category?: PriceCategoryData; // возвращается из search (include: { category })
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

// ============================================================
// КАТЕГОРИИ
// ============================================================

// Все категории (для селектов)
// GET /price-list/categories
export const fetchCategories = async (token: string): Promise<PriceCategoryData[]> => {
  const response = await axios.get(`${API_URL}/categories`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
};

// Категории вместе с активными расценками (для страницы справочника)
// GET /price-list/categories/full
export const fetchCategoriesWithItems = async (token: string): Promise<PriceCategoryData[]> => {
  const response = await axios.get(`${API_URL}/categories/full`, {
    headers: { Authorization: `Bearer ${token}` },
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

// ============================================================
// РАСЦЕНКИ (PriceItem)
// ============================================================

// Поиск расценок (для Autocomplete в материалах и для фильтра на странице справочника)
// GET /price-list/items/search?search=&categoryId=
export const searchPriceItems = async (
  token: string,
  search?: string,
  categoryId?: number
): Promise<PriceItemData[]> => {
  const response = await axios.get(`${API_URL}/items/search`, {
    headers: { Authorization: `Bearer ${token}` },
    params: {
      ...(search ? { search } : {}),
      ...(categoryId ? { categoryId } : {}),
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