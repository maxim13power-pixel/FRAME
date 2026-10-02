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

export interface BrigadeShiftData {
  id: number;
  brigadeId: number;
  projectId?: number | null;
  project?: { id: number; name: string } | null;
  date: string; // YYYY-MM-DD
  hoursWorked: number;
  outputValue?: number | null;
  outputArea?: number | null;
  comment?: string | null;
  createdBy: number;
  createdAt?: string;
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
  hoursWorked: parseDecimal(s.hoursWorked),
  outputValue: s.outputValue != null ? parseDecimal(s.outputValue) : null,
  outputArea: s.outputArea != null ? parseDecimal(s.outputArea) : null,
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

export const logBrigadeShift = async (
  brigadeId: number,
  data: {
    date: string;
    hoursWorked: number;
    outputValue?: number;
    outputArea?: number;
    projectId?: number;
    comment?: string;
  },
): Promise<BrigadeShiftData> => {
  const response = await api.post(`/brigades/${brigadeId}/shifts`, data);
  return normalizeShift(response.data);
};

export const updateBrigadeShift = async (
  brigadeId: number,
  shiftId: number,
  data: {
    date: string;
    hoursWorked: number;
    outputValue?: number;
    outputArea?: number;
    projectId?: number;
    comment?: string;
  },
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
