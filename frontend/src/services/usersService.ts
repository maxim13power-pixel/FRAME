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

// ⭐ Объект с участниками (сводная карточка на странице «Участники»)
export interface TeamObject {
  id: number;
  name: string;
  address: string;
  isArchived: boolean;
  myRole: AccessRole;
  members: TeamMember[];
}

// Сводный список участников по всем моим объектам
export const fetchTeam = async (): Promise<TeamObject[]> => {
  const response = await api.get('/users/team');
  return response.data;
};
