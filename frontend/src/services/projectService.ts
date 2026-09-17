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