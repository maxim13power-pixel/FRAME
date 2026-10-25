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
  // ⭐ №168: личный архив / отзыв доступа / управление командой
  accessId?: number | null;
  hiddenForMe?: boolean;
  revoked?: boolean;
  isManager?: boolean;
  canWrite?: boolean;
  canManage?: boolean;
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