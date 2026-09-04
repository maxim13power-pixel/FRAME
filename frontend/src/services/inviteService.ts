import axios from 'axios';
import type { AccessRole } from './accessService';

const API_URL = 'http://localhost:3000';

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
  authToken: string,
  objectId: number,
  payload: CreateInvitePayload,
): Promise<InviteLink> => {
  const response = await axios.post(
    `${API_URL}/objects/${objectId}/invite-link`,
    payload,
    { headers: { Authorization: `Bearer ${authToken}` } },
  );
  return response.data;
};

// 2. Список активных ссылок объекта
export const fetchInviteLinks = async (
  authToken: string,
  objectId: number,
): Promise<InviteLink[]> => {
  const response = await axios.get(
    `${API_URL}/objects/${objectId}/invite-links`,
    { headers: { Authorization: `Bearer ${authToken}` } },
  );
  return response.data;
};

// 3. Отозвать ссылку
export const revokeInviteLink = async (
  authToken: string,
  objectId: number,
  linkId: number,
): Promise<void> => {
  await axios.delete(`${API_URL}/objects/${objectId}/invite-links/${linkId}`, {
    headers: { Authorization: `Bearer ${authToken}` },
  });
};

// 4. Принять приглашение (авторизованный юзер)
export const acceptInvite = async (
  authToken: string,
  inviteToken: string,
): Promise<{ message: string; objectId: number; role: AccessRole }> => {
  const response = await axios.post(
    `${API_URL}/invite/${inviteToken}/accept`,
    {},
    { headers: { Authorization: `Bearer ${authToken}` } },
  );
  return response.data;
};

// 5. Публичная инфа о приглашении (для страницы принятия, БЕЗ токена)
export const getInviteInfo = async (inviteToken: string) => {
  const response = await axios.get(`${API_URL}/invite/${inviteToken}`);
  return response.data;
};