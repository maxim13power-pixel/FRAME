// frontend/src/services/rentalsService.ts
// ⭐ Раздел «Аренда»: API личного оборудования пользователя.
// ⭐ Шаг 99: токен больше не передаём аргументом — Bearer подставляет api.ts.
import api from './api';

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
export const fetchRentals = async (): Promise<RentalData[]> => {
  const response = await api.get('/rentals');
  return response.data;
};

// Создать аренду
export const createRental = async (
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
  const response = await api.post('/rentals', data);
  return response.data;
};

// Продлить аренду (новая дата окончания + цена продления)
export const extendRental = async (
  id: number,
  data: { newEndDate: string; price: number }
) => {
  const response = await api.patch(`/rentals/${id}/extend`, data);
  return response.data;
};

// Редактировать аренду (все поля опциональны; price/totalSpent не трогаем)
export const updateRental = async (
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
  const response = await api.patch(`/rentals/${id}`, data);
  return response.data;
};

// Удалить аренду
export const deleteRental = async (id: number) => {
  const response = await api.delete(`/rentals/${id}`);
  return response.data;
};