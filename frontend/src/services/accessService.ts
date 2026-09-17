// frontend/src/services/accessService.ts
// ⭐ Шаг 99: все запросы идут через единый api-инстанс — Bearer подставляет интерцептор.
import api from './api';

// ⭐ Роли доступа (должны совпадать с AccessRole в Prisma)
export type AccessRole = 'CUSTOMER' | 'FOREMAN' | 'VIEWER';

// ⭐ Участник объекта (то, что приходит с бэка)
export interface AccessMember {
  id: number;
  userId: number;
  objectId: number;
  projectId: number | null;
  role: AccessRole;
  invitedBy: number | null;
  createdAt: string;
  user: {
    id: number;
    fullName: string | null;
    email: string | null;
    phone: string | null;
  };
}

// ⭐ Payload для приглашения (одно из трёх: userId / email / phone)
export interface AddAccessPayload {
  userId?: number;
  email?: string;
  phone?: string;
  role: AccessRole;
  projectId?: number | null; // null = весь объект
}

//  Payload для смены роли
export interface UpdateAccessPayload {
  role: AccessRole;
}

// 1. Получить список участников объекта
export const fetchAccessList = async (
  objectId: number,
): Promise<AccessMember[]> => {
  const response = await api.get(`/objects/${objectId}/access`);
  return response.data;
};

// 2. Пригласить пользователя
export const addAccess = async (
  objectId: number,
  payload: AddAccessPayload,
): Promise<AccessMember> => {
  const response = await api.post(`/objects/${objectId}/access`, payload);
  return response.data;
};

// 3. Сменить роль участника
export const updateAccess = async (
  objectId: number,
  accessId: number,
  payload: UpdateAccessPayload,
): Promise<AccessMember> => {
  const response = await api.patch(`/objects/${objectId}/access/${accessId}`, payload);
  return response.data;
};

// 4. Отозвать доступ (уволить воригу 🚪)
export const removeAccess = async (
  objectId: number,
  accessId: number,
): Promise<void> => {
  await api.delete(`/objects/${objectId}/access/${accessId}`);
};