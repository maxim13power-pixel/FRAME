// frontend/src/services/warehouseService.ts
// ⭐ Раздел «Склад»: API позиций и операций (приход/расход/списание).
// 🔒 Decimal (quantity/price) приходят СТРОКАМИ — приводим к number на границе API.
import api from './api';
import { parseDecimal } from '../utils/decimal';

export type WarehouseTransactionType = 'income' | 'expense' | 'write-off';

export interface WarehouseTransactionData {
  id: number;
  warehouseItemId: number;
  type: WarehouseTransactionType;
  quantity: number;
  price?: number | null;
  projectId?: number | null;
  project?: { id: number; name: string } | null;
  warehouseItem?: { id: number; name: string; unit: string };
  comment?: string | null;
  createdAt: string;
}

export interface WarehouseItemData {
  id: number;
  name: string;
  unit: string;
  category?: string | null;
  quantity: number;
  price?: number | null;
  comment?: string | null;
  objectId?: number | null;
  object?: { id: number; name: string } | null;
  createdAt?: string;
  updatedAt?: string;
  transactions?: WarehouseTransactionData[];
}

const normalizeTx = (t: WarehouseTransactionData): WarehouseTransactionData => ({
  ...t,
  quantity: parseDecimal(t.quantity),
  price: t.price != null ? parseDecimal(t.price) : null,
});

const normalizeItem = (i: WarehouseItemData): WarehouseItemData => ({
  ...i,
  quantity: parseDecimal(i.quantity),
  price: i.price != null ? parseDecimal(i.price) : null,
  transactions: i.transactions?.map(normalizeTx),
});

// Список позиций (фильтр ?objectId=X, ?search=Y)
export const fetchWarehouseItems = async (params?: {
  objectId?: number;
  search?: string;
}): Promise<WarehouseItemData[]> => {
  const response = await api.get('/warehouse/items', { params });
  return response.data.map(normalizeItem);
};

// Детальная позиция + последние операции
export const fetchWarehouseItem = async (id: number): Promise<WarehouseItemData> => {
  const response = await api.get(`/warehouse/items/${id}`);
  return normalizeItem(response.data);
};

// Создать позицию
export const createWarehouseItem = async (data: {
  name: string;
  unit?: string;
  category?: string;
  quantity?: number;
  price?: number;
  comment?: string;
  objectId?: number;
}): Promise<WarehouseItemData> => {
  const response = await api.post('/warehouse/items', data);
  return normalizeItem(response.data);
};

// Редактировать позицию (name/unit/category/comment)
export const updateWarehouseItem = async (
  id: number,
  data: { name?: string; unit?: string; category?: string; comment?: string },
): Promise<WarehouseItemData> => {
  const response = await api.patch(`/warehouse/items/${id}`, data);
  return normalizeItem(response.data);
};

// Удалить позицию
export const deleteWarehouseItem = async (id: number) => {
  const response = await api.delete(`/warehouse/items/${id}`);
  return response.data;
};

// Операция (приход/расход/списание)
export const createWarehouseTransaction = async (data: {
  warehouseItemId: number;
  type: WarehouseTransactionType;
  quantity: number;
  price?: number;
  projectId?: number;
  comment?: string;
}): Promise<WarehouseTransactionData> => {
  const response = await api.post('/warehouse/transactions', data);
  return normalizeTx(response.data);
};
