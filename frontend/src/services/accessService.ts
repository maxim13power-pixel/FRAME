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
  // ⭐ №207: «прораб-менеджер» упразднён — право создавать проекты отдельным флагом
  canCreateProjects: boolean;
  isHidden: boolean;
  // ⭐ №182: участнику скрыты цены (фиксируется приглашением, потом не меняется)
  hidePrices: boolean;
  revokedAt: string | null;
  revokedById: number | null;
  user: {
    id: number;
    fullName: string | null;
    email: string | null;
    phone: string | null;
  };
}

// ⭐ №168: моя запись доступа (страница «Мои доступы»)
export interface MyAccess {
  id: number;
  objectId: number;
  objectName: string;
  objectAddress: string;
  projectId: number | null;
  projectName: string | null;
  role: AccessRole;
  canCreateProjects: boolean;
  isHidden: boolean;
  revokedAt: string | null;
  createdAt: string;
}

// ⭐ Payload для приглашения (одно из трёх: userId / email / phone)
export interface AddAccessPayload {
  userId?: number;
  email?: string;
  phone?: string;
  role: AccessRole;
  projectId?: number | null; // null = весь объект
  // ⭐ №207: право создавать проекты (только прораб + доступ на весь объект)
  canCreateProjects?: boolean;
  hidePrices?: boolean; // ⭐ №182: фиксируется приглашением
}

// ⭐ Payload для смены роли / права создавать проекты.
// Видимости цен здесь нет: она задаётся только при приглашении (№207).
export interface UpdateAccessPayload {
  role?: AccessRole;
  canCreateProjects?: boolean;
}

// ⭐ №207: что вернуло удаление участника (для сообщения «копия сохранена»)
export interface RemoveAccessResult {
  success: boolean;
  removed: number;
  templates: number;
  catalogCopied: boolean;
  snapshots: number;
}

// 1. Получить список участников объекта
export const fetchAccessList = async (
  objectId: number,
): Promise<AccessMember[]> => {
  const response = await api.get(`/objects/${objectId}/access`);
  return response.data;
};

// 2. Пригласить пользователя (или вернуть ранее отозванного — тем же запросом)
export const addAccess = async (
  objectId: number,
  payload: AddAccessPayload,
): Promise<AccessMember> => {
  const response = await api.post(`/objects/${objectId}/access`, payload);
  return response.data;
};

// 3. Сменить роль участника / права менеджера
export const updateAccess = async (
  objectId: number,
  accessId: number,
  payload: UpdateAccessPayload,
): Promise<AccessMember> => {
  const response = await api.patch(
    `/objects/${objectId}/access/${accessId}`,
    payload,
  );
  return response.data;
};

// 4. ⭐ №207: удалить участника. Бэкенд перед удалением снимает личные копии
// (шаблоны смет + снимок доступа), затем жёстко удаляет все его записи доступа.
export const removeAccess = async (
  objectId: number,
  accessId: number,
): Promise<RemoveAccessResult> => {
  const response = await api.delete(`/objects/${objectId}/access/${accessId}`);
  return response.data;
};

// 7. ⭐ №168: мои доступы (активные / архив / отозванные)
export const fetchMyAccess = async (): Promise<MyAccess[]> => {
  const response = await api.get('/me/access');
  return response.data;
};

// 8. ⭐ №168: личный архив — скрыть/показать объект только у себя
export const setMyAccessHidden = async (
  accessId: number,
  isHidden: boolean,
): Promise<{ success: boolean; isHidden: boolean }> => {
  const response = await api.patch(`/me/access/${accessId}`, { isHidden });
  return response.data;
};
