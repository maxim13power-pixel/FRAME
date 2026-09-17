// frontend/src/services/materialService.ts
// ⭐ Шаг 99: все запросы идут через единый api-инстанс — Bearer подставляет интерцептор.
import api from './api';
import type { ProjectData } from './projectService';

// Снапшот расценки из справочника (приходит вместе с материалом)
export interface PriceItemSnapshot {
  id: number;
  name: string;
  article?: string | null;
  unit: string;
  price: number;
  categoryId: number;
  isActive: boolean;
  kind: 'WORK' | 'MATERIAL';
  category?: {
    id: number;
    name: string;
    sortOrder: number;
    kind: 'WORK' | 'MATERIAL';
  };
}
export interface MaterialData {
  id: number;
  name: string;
  article?: string | null;
  unit: string;
  specQuantity: number;
  totalUsed: number;
  lastEntry?: number | null;
  lastEntryDate?: string | null;
  note?: string | null;
  progressPercent: number;
  isSpecLocked: boolean;

  // Работы
  priceItemId?: number | null;
  priceItem?: PriceItemSnapshot | null;
  unitPrice: number;
  totalCost: number;

  // Материалы
  materialItemId?: number | null;
  materialItem?: PriceItemSnapshot | null;
  materialUnitPrice: number;
  materialTotalCost: number;

  projectId: number;
  createdAt?: string;
  updatedAt?: string;
}
export interface MaterialFixData {
  id: number;
  materialId: number;
  amount: number;
  note?: string | null;
  fixedAt: string;
  userId?: number | null;
}

// Все материалы проекта
export const fetchMaterialsByProject = async (
  projectId: number
): Promise<MaterialData[]> => {
  const response = await api.get(`/materials/project/${projectId}`);
  return response.data;
};

// История фиксаций одного материала
export const fetchFixesByMaterial = async (
  materialId: number
): Promise<MaterialFixData[]> => {
  const response = await api.get(`/materials/${materialId}/fixes`);
  return response.data;
};

// Создание материала
export const createMaterial = async (
  data: {
    name: string;
    article?: string;
    unit?: string;
    specQuantity: number;
    note?: string;
    projectId: number;
    priceItemId?: number;
    materialItemId?: number;
  }
): Promise<MaterialData> => {
  const response = await api.post('/materials', data);
  return response.data;
};

// ⭐ Фиксация объёма (главная фича из старого кода)
export const addFix = async (
  materialId: number,
  data: { amount: number; note?: string }
): Promise<MaterialData> => {
  const response = await api.post(`/materials/${materialId}/fix`, data);
  return response.data;
};

// Обновление количества по спецификации
export const updateSpecQuantity = async (
  materialId: number,
  specQuantity: number
): Promise<MaterialData> => {
  const response = await api.patch(
    `/materials/${materialId}/spec`,
    { specQuantity }
  );
  return response.data;
};

// Переключение замка спецификации
export const toggleSpecLock = async (
  materialId: number
): Promise<MaterialData> => {
  const response = await api.patch(
    `/materials/${materialId}/lock`,
    {}
  );
  return response.data;
};
// ✏️ Правка последней фиксации (только младше 24 часов)
export const editLastFix = async (
  materialId: number,
  data: { amount: number; note?: string }
): Promise<MaterialData> => {
  const response = await api.patch(`/materials/${materialId}/last-fix`, data);
  return response.data;
};
// ✨ Создать новую расценку (+ опционально новую категорию)
export const createPriceItemForMaterial = async (
  item: {
    name: string;
    article?: string;
    unit: string;
    price: number;
    categoryId: number;
  },
  newCategoryName?: string,
  kind?: 'WORK' | 'MATERIAL'
) => {
  const response = await api.post(
    '/materials/price-item',
    { item, newCategoryName, kind }
  );
  return response.data;
};

// ✏️ Полное редактирование материала
export const updateMaterial = async (
  materialId: number,
  data: {
    name?: string;
    article?: string;
    unit?: string;
    specQuantity?: number;
    note?: string;
    priceItemId?: number | null;
    materialItemId?: number | null;
  }
): Promise<MaterialData> => {
  const response = await api.patch(`/materials/${materialId}`, data);
  return response.data;
};
// Удаление материала
export const deleteMaterial = async (
  materialId: number
): Promise<void> => {
  await api.delete(`/materials/${materialId}`);
};


// Загрузка проекта по ID (для хлебных крошек)
export const fetchProjectById = async (
  projectId: number
): Promise<ProjectData> => {
  const response = await api.get(`/projects/${projectId}`);
  return response.data;
};