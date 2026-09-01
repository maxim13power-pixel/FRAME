import axios from 'axios';

const API_URL = 'http://localhost:3000/objects';

export interface ObjectData {
  id: number;
  name: string;
  address: string;
  startDate: string;
  endDate: string;
  plannedEndDate?: string;
  createdAt?: string;
  note?: string | null;
  progressPercent?: number; // честный % из проектов
  totalCost?: number;
  role?: 'CUSTOMER' | 'FOREMAN' | 'VIEWER'; // ⭐ роль создателя объекта
}

// Получить все объекты
export const fetchObjects = async (token: string): Promise<ObjectData[]> => {
  const response = await axios.get(API_URL, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
};

// Создать объект
export const createObject = async (token: string, data: Omit<ObjectData, 'id' | 'createdAt'>) => {
  const response = await axios.post(API_URL, data, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
};

export const updateObject = async (token: string, id: number, data: Partial<Omit<ObjectData, 'id' | 'createdAt'>>) => {
  const response = await axios.patch(`${API_URL}/${id}`, data, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
};

export const deleteObject = async (token: string, id: number) => {
  const response = await axios.delete(`${API_URL}/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
};
// Получить один объект по ID
export const fetchObjectById = async (token: string, id: number): Promise<ObjectData> => {
  const response = await axios.get(`${API_URL}/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
};

export const updateObjectEndDate = async (
  token: string, 
  id: number, 
  endDate: string
) => {
  const response = await axios.patch(
    `${API_URL}/${id}/end-date`, 
    { endDate },
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return response.data;
};