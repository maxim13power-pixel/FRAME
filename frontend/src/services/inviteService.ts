// frontend/src/services/inviteService.ts
// ⭐ Шаг 99: все запросы идут через единый api-инстанс — Bearer подставляет интерцептор.
import api from './api';
import type { AccessRole } from './accessService';

// ⭐ Ссылка-приглашение (то, что приходит с бэка)
export interface InviteLink {
  id: number;
  token: string;
  objectId: number;
  createdBy: number;
  role: AccessRole;
  hidePrices: boolean;
  expiresAt: string | null;
  maxUses: number | null;
  usesCount: number;
  isActive: boolean;
  createdAt: string;
  creator?: { id: number; fullName: string | null };
}

// ⭐ Payload для создания ссылки
export interface CreateInvitePayload {
  role: AccessRole;
  hidePrices?: boolean;
  expiresAt?: string;
  maxUses?: number;
}

// 1. Создать ссылку-приглашение
export const createInviteLink = async (
  objectId: number,
  payload: CreateInvitePayload,
): Promise<InviteLink> => {
  const response = await api.post(`/objects/${objectId}/invite-link`, payload);
  return response.data;
};

// 2. Список активных ссылок объекта
export const fetchInviteLinks = async (objectId: number): Promise<InviteLink[]> => {
  const response = await api.get(`/objects/${objectId}/invite-links`);
  return response.data;
};

// 3. Отозвать ссылку
export const revokeInviteLink = async (
  objectId: number,
  linkId: number,
): Promise<void> => {
  await api.delete(`/objects/${objectId}/invite-links/${linkId}`);
};

// 4. Принять приглашение (авторизованный юзер)
export const acceptInvite = async (
  inviteToken: string,
): Promise<{ message: string; objectId: number; role: AccessRole }> => {
  const response = await api.post(`/invite/${inviteToken}/accept`, {});
  return response.data;
};

// 5. Публичная инфа о приглашении (для страницы принятия, БЕЗ токена)
export const getInviteInfo = async (inviteToken: string) => {
  const response = await api.get(`/invite/${inviteToken}`);
  return response.data;
};