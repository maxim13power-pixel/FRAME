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
  isDemo?: boolean; // ⭐ №127: демо-объект онбординга
  isArchived?: boolean; // ⭐ архив вместо удаления (ТЗ 3.8)
}

// Получить все объекты
export const fetchObjects = async (): Promise<ObjectData[]> => {
  const response = await api.get('/objects');
  return response.data;
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

export const deleteObject = async (id: number, permanent = false) => {
  const response = await api.delete(`/objects/${id}`, {
    params: permanent ? { permanent: 'true' } : undefined,
  });
  return response.data;
};

// ⭐ Восстановить объект из архива
export const restoreObject = async (id: number) => {
  const response = await api.patch(`/objects/${id}/restore`);
  return response.data;
};

// Получить один объект по ID
export const fetchObjectById = async (id: number): Promise<ObjectData> => {
  const response = await api.get(`/objects/${id}`);
  return response.data;
};

export const updateObjectEndDate = async (id: number, endDate: string) => {
  const response = await api.patch(`/objects/${id}/end-date`, { endDate });
  return response.data;
};