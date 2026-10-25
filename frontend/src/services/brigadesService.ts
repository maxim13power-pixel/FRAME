// frontend/src/services/brigadesService.ts
// ⭐ Срез 4: бригады — учёт выходов и выработки.
import api from './api';
import { parseDecimal } from '../utils/decimal';

export interface BrigadeMemberData {
  id: number;
  brigadeId: number;
  fullName: string;
  role?: string | null;
  phone?: string | null;
  createdAt?: string;
}

/** ⭐ №169: строка состава выхода — кто был и сколько часов */
export interface BrigadeShiftMemberData {
  id: number;
  shiftId: number;
  memberId?: number | null;
  fullName: string;
  hours: number;
}

export interface BrigadeShiftData {
  id: number;
  brigadeId: number;
  projectId?: number | null;
  project?: { id: number; name: string } | null;
  date: string; // YYYY-MM-DD (бэкенд отдаёт строку, №169)
  hoursWorked: number;
  outputValue?: number | null;
  outputArea?: number | null;
  comment?: string | null;
  createdBy: number;
  createdAt?: string;
  /** ⭐ №169: состав выхода (пусто у старых записей) */
  members?: BrigadeShiftMemberData[];
}

export interface BrigadeData {
  id: number;
  name: string;
  specialty?: string | null;
  foremanName?: string | null;
  phone?: string | null;
  objectId?: number | null;
  object?: { id: number; name: string } | null;
  comment?: string | null;
  _count?: { members: number };
  members?: BrigadeMemberData[];
  shifts?: BrigadeShiftData[];
}

export interface BrigadeStats {
  totalHours: number;
  totalOutputValue: number;
  totalOutputArea: number;
  shiftsCount: number;
  avgHoursPerShift: number;
}

const normalizeShift = (s: BrigadeShiftData): BrigadeShiftData => ({
  ...s,
  // ⭐ №169: страховка — даже если бэкенд отдал полный ISO, оставляем YYYY-MM-DD,
  // иначе фильтры и график статистики не находят день.
  date: String(s.date).slice(0, 10),
  hoursWorked: parseDecimal(s.hoursWorked),
  outputValue: s.outputValue != null ? parseDecimal(s.outputValue) : null,
  outputArea: s.outputArea != null ? parseDecimal(s.outputArea) : null,
  members: s.members?.map((m) => ({ ...m, hours: parseDecimal(m.hours) })),
});

const normalizeBrigade = (b: BrigadeData): BrigadeData => ({
  ...b,
  shifts: b.shifts?.map(normalizeShift),
});

export const fetchBrigades = async (params?: {
  objectId?: number;
  search?: string;
}): Promise<BrigadeData[]> => {
  const response = await api.get('/brigades', { params });
  return response.data.map(normalizeBrigade);
};

export const fetchBrigade = async (id: number): Promise<BrigadeData> => {
  const response = await api.get(`/brigades/${id}`);
  return normalizeBrigade(response.data);
};

export const createBrigade = async (data: {
  name: string;
  specialty?: string;
  foremanName?: string;
  phone?: string;
  objectId?: number;
  comment?: string;
}): Promise<BrigadeData> => {
  const response = await api.post('/brigades', data);
  return normalizeBrigade(response.data);
};

export const updateBrigade = async (
  id: number,
  data: {
    name?: string;
    specialty?: string;
    foremanName?: string;
    phone?: string;
    objectId?: number;
    comment?: string;
  },
): Promise<BrigadeData> => {
  const response = await api.patch(`/brigades/${id}`, data);
  return normalizeBrigade(response.data);
};

export const deleteBrigade = async (id: number) => {
  const response = await api.delete(`/brigades/${id}`);
  return response.data;
};

export const addBrigadeMember = async (
  brigadeId: number,
  data: { fullName: string; role?: string; phone?: string },
): Promise<BrigadeMemberData> => {
  const response = await api.post(`/brigades/${brigadeId}/members`, data);
  return response.data;
};

export const deleteBrigadeMember = async (brigadeId: number, memberId: number) => {
  const response = await api.delete(`/brigades/${brigadeId}/members/${memberId}`);
  return response.data;
};

export const fetchBrigadeShifts = async (
  brigadeId: number,
  params?: { from?: string; to?: string; projectId?: number },
): Promise<BrigadeShiftData[]> => {
  const response = await api.get(`/brigades/${brigadeId}/shifts`, { params });
  return response.data.map(normalizeShift);
};

/** ⭐ №169: тело запроса на выход — часы считает сервер по составу */
export interface BrigadeShiftPayload {
  date: string;
  hoursWorked?: number;
  members?: { memberId: number; hours: number }[];
  outputValue?: number;
  outputArea?: number;
  projectId?: number;
  comment?: string;
}

export const logBrigadeShift = async (
  brigadeId: number,
  data: BrigadeShiftPayload,
): Promise<BrigadeShiftData> => {
  const response = await api.post(`/brigades/${brigadeId}/shifts`, data);
  return normalizeShift(response.data);
};

export const updateBrigadeShift = async (
  brigadeId: number,
  shiftId: number,
  data: BrigadeShiftPayload,
): Promise<BrigadeShiftData> => {
  const response = await api.patch(`/brigades/${brigadeId}/shifts/${shiftId}`, data);
  return normalizeShift(response.data);
};

export const deleteBrigadeShift = async (brigadeId: number, shiftId: number) => {
  const response = await api.delete(`/brigades/${brigadeId}/shifts/${shiftId}`);
  return response.data;
};

export const fetchBrigadeStats = async (brigadeId: number): Promise<BrigadeStats> => {
  const response = await api.get(`/brigades/${brigadeId}/stats`);
  return response.data;
};
