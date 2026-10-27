// frontend/src/services/accessRequestService.ts
// ⭐ №178: заявки на право создавать проекты в объекте
import api from './api';

export type AccessRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
export type AccessRequestKind = 'CREATE_PROJECTS';

export interface AccessRequestData {
  id: number;
  objectId: number;
  requesterId: number;
  kind: AccessRequestKind;
  comment?: string | null;
  status: AccessRequestStatus;
  reviewedBy?: number | null;
  reviewComment?: string | null;
  reviewedAt?: string | null;
  createdAt: string;
  requester?: {
    id: number;
    fullName?: string | null;
    email?: string | null;
    phone?: string | null;
  };
  reviewer?: { id: number; fullName?: string | null } | null;
  object?: { id: number; name: string };
}

/** Подать заявку на право создавать проекты в объекте */
export const createAccessRequest = async (
  objectId: number,
  data: { comment?: string; kind?: AccessRequestKind } = {},
): Promise<AccessRequestData> => {
  const response = await api.post(`/objects/${objectId}/access-requests`, data);
  return response.data;
};

/** Мои заявки (исходящие) */
export const fetchMyAccessRequests = async (): Promise<AccessRequestData[]> => {
  const response = await api.get('/access-requests', { params: { box: 'outgoing' } });
  return response.data;
};

/** Входящие: админ — все, менеджер объекта — по своим объектам */
export const fetchIncomingAccessRequests = async (
  status?: AccessRequestStatus,
): Promise<AccessRequestData[]> => {
  const response = await api.get('/access-requests', {
    params: { box: 'incoming', ...(status ? { status } : {}) },
  });
  return response.data;
};

/** Заявки конкретного объекта (модалка управления доступом) */
export const fetchObjectAccessRequests = async (
  objectId: number,
): Promise<AccessRequestData[]> => {
  const response = await api.get(`/objects/${objectId}/access-requests`);
  return response.data;
};

/** Сколько висит на согласовании (бейдж) */
export const fetchPendingAccessRequestCount = async (): Promise<number> => {
  const response = await api.get('/access-requests/pending-count');
  return response.data?.count ?? 0;
};

export const approveAccessRequest = async (
  id: number,
  comment?: string,
): Promise<AccessRequestData> => {
  const response = await api.post(`/access-requests/${id}/approve`, { comment });
  return response.data;
};

export const rejectAccessRequest = async (
  id: number,
  comment?: string,
): Promise<AccessRequestData> => {
  const response = await api.post(`/access-requests/${id}/reject`, { comment });
  return response.data;
};

export const cancelAccessRequest = async (id: number): Promise<AccessRequestData> => {
  const response = await api.post(`/access-requests/${id}/cancel`);
  return response.data;
};
