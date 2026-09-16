// frontend/src/services/rentalsService.ts
// ⭐ Раздел «Аренда»: API личного оборудования пользователя.
// Токен — первым аргументом, Authorization Bearer (как в objectService).
import axios from 'axios';
import { API_BASE_URL } from '../config'; // ⭐ без хардкода localhost — берём из централизованного конфига

const API_URL = `${API_BASE_URL}/rentals`;

export interface RentalData {
  id: number;
  name: string;
  location?: string | null;      // где лежит (необязательно)
  responsible?: string | null;   // кто ответственный (необязательно)
  startDate: string;
  endDate: string;
  price: number;                 // цена аренды при создании
  totalSpent: number;            // всего потрачено (price + продления)
  note?: string | null;
  createdAt?: string;
}

// Получить все аренды текущего пользователя
export const fetchRentals = async (token: string): Promise<RentalData[]> => {
  const response = await axios.get(API_URL, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
};

// Создать аренду
export const createRental = async (
  token: string,
  data: {
    name: string;
    location?: string;
    responsible?: string;
    startDate: string;
    endDate: string;
    price: number;
    note?: string;
  }
) => {
  const response = await axios.post(API_URL, data, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
};

// Продлить аренду (новая дата окончания + цена продления)
export const extendRental = async (
  token: string,
  id: number,
  data: { newEndDate: string; price: number }
) => {
  const response = await axios.patch(`${API_URL}/${id}/extend`, data, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
};

// Редактировать аренду (все поля опциональны; price/totalSpent не трогаем)
export const updateRental = async (
  token: string,
  id: number,
  data: {
    name?: string;
    location?: string;
    responsible?: string;
    startDate?: string;
    endDate?: string;
    note?: string;
  }
) => {
  const response = await axios.patch(`${API_URL}/${id}`, data, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
};

// Удалить аренду
export const deleteRental = async (token: string, id: number) => {
  const response = await axios.delete(`${API_URL}/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
};