// frontend/src/services/usersService.ts
// ⭐ Шаг 99: все запросы идут через единый api-инстанс — Bearer подставляет интерцептор.
import api from './api';
import type { AccessRole } from './accessService';

// ⭐ Участник объекта (то, что приходит с бэка в /users/team)
export interface TeamMember {
  id: number;
  userId: number;
  fullName: string | null;
  email: string | null;
  phone: string | null;
  role: AccessRole;
  hidePrices: boolean;
  invitedBy: number | null;
  createdAt: string;
}

// ⭐ Объект с участниками (сводная карточка на странице «Моя команда»)
export interface TeamObject {
  id: number;
  name: string;
  address: string;
  isArchived: boolean;
  myRole: AccessRole;
  // ⭐ №184: область моего доступа — «Весь объект» или названия проектов
  scopes: string[];
  members: TeamMember[];
}

// Сводный список участников по всем моим объектам
export const fetchTeam = async (): Promise<TeamObject[]> => {
  const response = await api.get('/users/team');
  return response.data;
};

// ⭐ №130 (152-ФЗ): выгрузка своих персональных данных (JSON)
export const exportMyData = async (): Promise<unknown> => {
  const response = await api.get('/users/me/export');
  return response.data;
};

// ⭐ №130 (152-ФЗ): удаление аккаунта
export const deleteMyAccount = async (): Promise<void> => {
  await api.delete('/users/me');
};


// ⭐ №215: правка своего профиля (имя и телефон). Ответ — та же форма, что у login.user,
// поэтому контекст авторизации обновляется без перезагрузки.
export interface MyProfile {
  id: number;
  name: string | null;
  email: string | null;
  phone: string | null;
  role: string;
}

export const updateMyProfile = async (payload: {
  fullName?: string;
  phone?: string;
}): Promise<MyProfile> => {
  const response = await api.patch('/users/me', payload);
  return response.data;
};
