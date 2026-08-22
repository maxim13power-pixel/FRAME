import axios from 'axios';

const API_URL = 'http://localhost:3000/projects';

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

export const fetchProjectsByObject = async (token: string, objectId: number): Promise<ProjectData[]> => {
  const response = await axios.get(`${API_URL}/object/${objectId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
};

export const createProject = async (token: string, data: Omit<ProjectData, 'id' | 'createdAt' | 'updatedAt'>) => {
  const response = await axios.post(API_URL, data, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
};

export const updateProject = async (token: string, id: number, data: Partial<Omit<ProjectData, 'id' | 'createdAt' | 'updatedAt'>>) => {
  const response = await axios.patch(`${API_URL}/${id}`, data, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
};

export const deleteProject = async (token: string, id: number) => {
  const response = await axios.delete(`${API_URL}/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
};