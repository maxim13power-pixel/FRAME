// frontend/src/services/reportsService.ts
// ⭐ Раздел «Отчёты»: сметы и акты (API из №122a).
// 🔒 Decimal (quantity/price/total/totalAmount) приходят СТРОКАМИ — приводим к number.
import api from './api';
import { parseDecimal } from '../utils/decimal';

export type ReportType = 'estimate' | 'act';
export type ReportStatus = 'draft' | 'sent' | 'approved' | 'rejected';

export interface ReportItemData {
  id: number;
  reportId: number;
  materialId?: number | null;
  material?: { id: number; name: string; unit: string; price: number | string } | null;
  name: string;
  unit: string;
  quantity: number;
  price: number;
  total: number;
  sortOrder: number;
}

export interface ReportData {
  id: number;
  type: ReportType;
  title: string;
  projectId: number;
  project?: { id: number; name: string } | null;
  objectId: number;
  object?: { id: number; name: string } | null;
  totalAmount: number;
  status: ReportStatus;
  comment?: string | null;
  createdBy: number;
  createdAt: string;
  updatedAt: string;
  items?: ReportItemData[];
}

const normalizeItem = (i: ReportItemData): ReportItemData => ({
  ...i,
  quantity: parseDecimal(i.quantity),
  price: parseDecimal(i.price),
  total: parseDecimal(i.total),
  material: i.material
    ? { ...i.material, price: parseDecimal(i.material.price) }
    : i.material,
});

const normalizeReport = (r: ReportData): ReportData => ({
  ...r,
  totalAmount: parseDecimal(r.totalAmount),
  items: r.items?.map(normalizeItem),
});

export const fetchReports = async (params?: {
  projectId?: number;
  objectId?: number;
  type?: ReportType;
  status?: ReportStatus;
}): Promise<ReportData[]> => {
  const response = await api.get('/reports', { params });
  return response.data.map(normalizeReport);
};

export const fetchReport = async (id: number): Promise<ReportData> => {
  const response = await api.get(`/reports/${id}`);
  return normalizeReport(response.data);
};

export const createReport = async (data: {
  type: ReportType;
  title: string;
  projectId: number;
  objectId: number;
  comment?: string;
}): Promise<ReportData> => {
  const response = await api.post('/reports', data);
  return normalizeReport(response.data);
};

export const updateReport = async (
  id: number,
  data: { title?: string; status?: ReportStatus; comment?: string },
): Promise<ReportData> => {
  const response = await api.patch(`/reports/${id}`, data);
  return normalizeReport(response.data);
};

export const deleteReport = async (id: number) => {
  const response = await api.delete(`/reports/${id}`);
  return response.data;
};

export const addReportItem = async (
  reportId: number,
  data: { materialId?: number; name?: string; unit?: string; quantity: number; price?: number },
): Promise<ReportItemData> => {
  const response = await api.post(`/reports/${reportId}/items`, data);
  return normalizeItem(response.data);
};

export const updateReportItem = async (
  reportId: number,
  itemId: number,
  data: { name?: string; unit?: string; quantity?: number; price?: number; total?: number },
): Promise<ReportItemData> => {
  const response = await api.patch(`/reports/${reportId}/items/${itemId}`, data);
  return normalizeItem(response.data);
};

export const deleteReportItem = async (reportId: number, itemId: number) => {
  const response = await api.delete(`/reports/${reportId}/items/${itemId}`);
  return response.data;
};

// ⭐ №122c: скачивание PDF/XLSX (auth-заголовок подставляет api-инстанс)
export const downloadReportExport = async (reportId: number, format: 'pdf' | 'xlsx') => {
  const response = await api.get(`/reports/${reportId}/export/${format}`, {
    responseType: 'blob',
  });
  const type =
    format === 'pdf'
      ? 'application/pdf'
      : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  const blob = new Blob([response.data], { type });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `report-${reportId}.${format === 'pdf' ? 'pdf' : 'xlsx'}`;
  a.click();
  window.URL.revokeObjectURL(url);
};
