// frontend/src/services/snapshotService.ts
// ⭐ №194 (F1 шаг 2): «Снимок доступа» — только чтение. Слепок создаёт бэкенд
// в момент отзыва; фронт показывает список копий и одну копию целиком.
import api from './api';
import type { AccessRole } from './accessService';

export interface SnapshotSummary {
  projects: number;
  materials: number;
  reports: number;
  warehouseItems: number;
  warehouseTransactions: number;
  brigades: number;
  shifts: number;
}

export interface SnapshotRow {
  id: number;
  objectId: number;
  objectName: string;
  projectId: number | null;
  projectName: string | null;
  role: AccessRole;
  hidePrices: boolean;
  takenAt: string;
  summary: SnapshotSummary;
}

export interface SnapshotMaterial {
  name: string;
  article: string | null;
  unit: string;
  specQuantity: number | null;
  totalUsed: number | null;
  lastEntryDate: string | null;
  note: string | null;
  unitPrice: number | null;
  materialUnitPrice: number | null;
}

export interface SnapshotPayload {
  version: number;
  takenAt: string;
  object: {
    id: number;
    name: string;
    address: string;
    startDate: string | null;
    endDate: string | null;
    note: string | null;
  };
  projects: {
    id: number;
    name: string;
    startDate: string | null;
    endDate: string | null;
    note: string | null;
    materials: SnapshotMaterial[];
  }[];
  reports: {
    id: number;
    projectId: number;
    type: string;
    title: string;
    status: string;
    createdAt: string | null;
    totalAmount: number | null;
    items: { name: string; unit: string; quantity: number | null; price: number | null; total: number | null }[];
  }[];
  warehouse: {
    items: { name: string; unit: string; category: string | null; quantity: number | null; price: number | null }[];
    transactions: {
      type: string;
      quantity: number | null;
      price: number | null;
      createdAt: string | null;
      itemName: string;
      projectName: string | null;
    }[];
  };
  brigades: {
    name: string;
    specialty: string | null;
    foremanName: string | null;
    phone: string | null;
    members: { fullName: string; role: string | null; phone: string | null }[];
    shifts: {
      date: string | null;
      hoursWorked: number | null;
      outputValue: number | null;
      projectName: string | null;
      members: { fullName: string; hours: number | null }[];
    }[];
  }[];
}

export interface SnapshotDetail extends SnapshotRow {
  payload: SnapshotPayload;
}

export const fetchSnapshots = async (): Promise<SnapshotRow[]> => {
  const response = await api.get('/me/snapshots');
  return response.data;
};

export const fetchSnapshot = async (id: number): Promise<SnapshotDetail> => {
  const response = await api.get(`/me/snapshots/${id}`);
  return response.data;
};
