import axios from 'axios';
import type { ProjectData } from './projectService';

const API_URL = 'http://localhost:3000/materials';

// Снапшот расценки из справочника (приходит вместе с материалом)
export interface PriceItemSnapshot {
  id: number;
  name: string;
  article?: string | null;
  unit: string;
  price: number;
  categoryId: number;
  category?: {
    id: number;
    name: string;
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
  // ⭐ Интеграция цен из справочника
  priceItemId?: number | null;
  unitPrice: number; // snapshot цены на момент привязки
  totalCost: number; // totalUsed × unitPrice (считает бэкенд)
  priceItem?: PriceItemSnapshot | null;
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
  token: string,
  projectId: number
): Promise<MaterialData[]> => {
  const response = await axios.get(`${API_URL}/project/${projectId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
};

// История фиксаций одного материала
export const fetchFixesByMaterial = async (
  token: string,
  materialId: number
): Promise<MaterialFixData[]> => {
  const response = await axios.get(`${API_URL}/${materialId}/fixes`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
};

// Создание материала
export const createMaterial = async (
  token: string,
  data: {
    name: string;
    article?: string;
    unit?: string;
    specQuantity: number;
    note?: string;
    projectId: number;
    priceItemId?: number;
  }
): Promise<MaterialData> => {
  const response = await axios.post(API_URL, data, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
};

// ⭐ Фиксация объёма (главная фича из старого кода)
export const addFix = async (
  token: string,
  materialId: number,
  data: { amount: number; note?: string }
): Promise<MaterialData> => {
  const response = await axios.post(`${API_URL}/${materialId}/fix`, data, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
};

// Обновление количества по спецификации
export const updateSpecQuantity = async (
  token: string,
  materialId: number,
  specQuantity: number
): Promise<MaterialData> => {
  const response = await axios.patch(
    `${API_URL}/${materialId}/spec`,
    { specQuantity },
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return response.data;
};

// Переключение замка спецификации
export const toggleSpecLock = async (
  token: string,
  materialId: number
): Promise<MaterialData> => {
  const response = await axios.patch(
    `${API_URL}/${materialId}/lock`,
    {},
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return response.data;
};

// Удаление материала
export const deleteMaterial = async (
  token: string,
  materialId: number
): Promise<void> => {
  await axios.delete(`${API_URL}/${materialId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
};


// Загрузка проекта по ID (для хлебных крошек)
export const fetchProjectById = async (
  token: string,
  projectId: number
): Promise<ProjectData> => {
  const response = await axios.get(
    `http://localhost:3000/projects/${projectId}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return response.data;
};