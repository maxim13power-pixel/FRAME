// frontend/src/services/rentalsService.ts
// ⭐ Раздел «Аренда»: API личного оборудования пользователя.
// ⭐ Шаг 99: токен больше не передаём аргументом — Bearer подставляет api.ts.
// ⭐ Шаг 103 (P1-3): price/totalSpent хранятся в DECIMAL и приходят СТРОКАМИ —
// приводим к number на границе API (иначе сортировка и Σ склеивают строки).
import api from './api';
import { parseDecimal } from '../utils/decimal';

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
  // ⭐ №368: дата завершения (null = активна)
  closedAt?: string | null;
}

// 🔒 P1-3: Decimal (строка с бэкенда) -> number на границе API
const normalizeRental = (r: RentalData): RentalData => ({
  ...r,
  price: parseDecimal(r.price),
  totalSpent: parseDecimal(r.totalSpent),
});

export type RentalStatusFilter = 'active' | 'closed' | 'all';

// ⭐ №368: список с фильтром «активные / завершённые / все»
export const fetchRentals = async (
  status: RentalStatusFilter = 'active',
): Promise<RentalData[]> => {
  const response = await api.get('/rentals', { params: { status } });
  return response.data.map(normalizeRental);
};

// ⭐ №368: завершить аренду / вернуть в работу
export const closeRental = async (id: number): Promise<RentalData> => {
  const response = await api.post(`/rentals/${id}/close`);
  return normalizeRental(response.data);
};

export const reopenRental = async (id: number): Promise<RentalData> => {
  const response = await api.post(`/rentals/${id}/reopen`);
  return normalizeRental(response.data);
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
  return normalizeRental(response.data);
};

// Продлить аренду (новая дата окончания + цена продления)
export const extendRental = async (
  id: number,
  data: { newEndDate: string; price: number }
) => {
  const response = await api.patch(`/rentals/${id}/extend`, data);
  return normalizeRental(response.data);
};

// Редактировать аренду (все поля опциональны; цену можно исправить — №368)
export const updateRental = async (
  id: number,
  data: {
    name?: string;
    location?: string;
    responsible?: string;
    startDate?: string;
    endDate?: string;
    note?: string;
    price?: number;
  }
) => {
  const response = await api.patch(`/rentals/${id}`, data);
  return normalizeRental(response.data);
};

// Удалить аренду
export const deleteRental = async (id: number) => {
  const response = await api.delete(`/rentals/${id}`);
  return response.data;
};