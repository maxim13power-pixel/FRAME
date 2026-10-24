// frontend/src/services/projectService.ts
// ⭐ Шаг 99: все запросы идут через единый api-инстанс — Bearer подставляет интерцептор.
import api from './api';

export interface ProjectData {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
  objectId: number;
  note?: string | null;
  progressPercent?: number;
  totalCost?: number;
  createdAt?: string;
  updatedAt?: string;
  // ⭐ №158: привязка справочника цен — новые строки сметы берут цены из него
  catalogId?: number | null;
  catalog?: { id: number; name: string } | null;
  // ⭐ №164: действующий справочник = свой проекта → справочник объекта → нет
  effectiveCatalogId?: number | null;
  effectiveCatalogName?: string | null;
  catalogSource?: 'project' | 'object' | null;
  // ⭐ №158: сколько строк уже в смете (нужно для предупреждения при смене справочника)
  materialsCount?: number;
}

export const fetchProjectsByObject = async (objectId: number): Promise<ProjectData[]> => {
  const response = await api.get(`/projects/object/${objectId}`);
  return response.data;
};

export const createProject = async (data: Omit<ProjectData, 'id' | 'createdAt' | 'updatedAt'>) => {
  const response = await api.post('/projects', data);
  return response.data;
};

export const updateProject = async (id: number, data: Partial<Omit<ProjectData, 'id' | 'createdAt' | 'updatedAt'>>) => {
  const response = await api.patch(`/projects/${id}`, data);
  return response.data;
};

export const deleteProject = async (id: number) => {
  const response = await api.delete(`/projects/${id}`);
  return response.data;
};