// frontend/src/services/inviteService.ts
// ⭐ Шаг 99: все запросы идут через единый api-инстанс — Bearer подставляет интерцептор.
import api from './api';
import type { AccessRole } from './accessService';

// ⭐ Ссылка-приглашение (то, что приходит с бэка)
export interface InviteLink {
  id: number;
  token: string;
  objectId: number;
  projectId?: number | null;
  project?: { id: number; name: string } | null;
  createdBy: number;
  role: AccessRole;
  hidePrices: boolean;
  /** ⭐ №303: «разрешить создавать проекты» (только прораб + ссылка на весь объект) */
  canCreateProjects: boolean;
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
  canCreateProjects?: boolean; // ⭐ №303
  expiresAt?: string;
  maxUses?: number;
  projectId?: number;
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
export const fetchInviteLinks = async (
  objectId: number,
  projectId?: number,
): Promise<InviteLink[]> => {
  const response = await api.get(`/objects/${objectId}/invite-links`, {
    params: projectId != null ? { projectId } : undefined,
  });
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
// ⭐ №341: confirmDowngrade — подтверждение, если ссылка понижает роль
export const acceptInvite = async (
  inviteToken: string,
  confirmDowngrade = false,
): Promise<{
  message: string;
  objectId: number;
  projectId?: number | null;
  projectName?: string | null;
  role: AccessRole;
  alreadyHasAccess?: boolean;
  updated?: boolean;
  hidePrices?: boolean;
  scope?: 'object' | 'project';
  mergedProjects?: number;
}> => {
  const response = await api.post(`/invite/${inviteToken}/accept`, {
    ...(confirmDowngrade ? { confirmDowngrade: true } : {}),
  });
  return response.data;
};

/** ⭐ №342: какие настройки поменяет ссылка у человека с объектным доступом */
export interface InviteStatusChanges {
  role: { from: AccessRole; to: AccessRole } | null;
  hidePrices: { from: boolean; to: boolean } | null;
  canCreateProjects: { from: boolean; to: boolean } | null;
}

// 5. ⭐ №341/№342: что будет, если принять ссылку
export const getInviteStatus = async (
  inviteToken: string,
): Promise<{
  alreadyHasAccess: 'object' | 'project' | null;
  role?: AccessRole;
  changes?: InviteStatusChanges;
  downgrade?: {
    fromRole: AccessRole;
    toRole: AccessRole;
    projects: string[];
  };
}> => {
  const response = await api.get(`/invite/${inviteToken}/status`);
  return response.data;
};

// 5. Публичная инфа о приглашении (для страницы принятия, БЕЗ токена)
export const getInviteInfo = async (inviteToken: string) => {
  const response = await api.get(`/invite/${inviteToken}`);
  return response.data;
};