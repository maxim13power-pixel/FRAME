import axios from 'axios';

const API_URL = 'http://localhost:3000/objects';

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

// ⭐ Payload для смены роли
export interface UpdateAccessPayload {
  role: AccessRole;
}

// 1. Получить список участников объекта
export const fetchAccessList = async (
  token: string,
  objectId: number,
): Promise<AccessMember[]> => {
  const response = await axios.get(`${API_URL}/${objectId}/access`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
};

// 2. Пригласить пользователя
export const addAccess = async (
  token: string,
  objectId: number,
  payload: AddAccessPayload,
): Promise<AccessMember> => {
  const response = await axios.post(
    `${API_URL}/${objectId}/access`,
    payload,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  return response.data;
};

// 3. Сменить роль участника
export const updateAccess = async (
  token: string,
  objectId: number,
  accessId: number,
  payload: UpdateAccessPayload,
): Promise<AccessMember> => {
  const response = await axios.patch(
    `${API_URL}/${objectId}/access/${accessId}`,
    payload,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  return response.data;
};

// 4. Отозвать доступ (уволить воригу 🚪)
export const removeAccess = async (
  token: string,
  objectId: number,
  accessId: number,
): Promise<void> => {
  await axios.delete(`${API_URL}/${objectId}/access/${accessId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
};