// frontend/src/services/estimateTemplateService.ts
// ⭐ №129: шаблоны смет — сохранить проект как шаблон и применить.
import api from './api';

export interface EstimateTemplateItem {
  id: number;
  templateId: number;
  name: string;
  unit: string;
  quantity: number | string;
  unitPrice: number | string;
  materialUnitPrice: number | string;
  priceItemId?: number | null;
  materialItemId?: number | null;
  sortOrder: number;
}

export interface EstimateTemplate {
  id: number;
  name: string;
  ownerId: number;
  createdAt: string;
  items: EstimateTemplateItem[];
}

export const fetchEstimateTemplates = async (): Promise<EstimateTemplate[]> => {
  const response = await api.get('/estimate-templates');
  return response.data;
};

export const createEstimateTemplate = async (data: {
  name: string;
  projectId: number;
}): Promise<EstimateTemplate> => {
  const response = await api.post('/estimate-templates', data);
  return response.data;
};

export const deleteEstimateTemplate = async (id: number): Promise<void> => {
  await api.delete(`/estimate-templates/${id}`);
};

export const applyEstimateTemplate = async (
  id: number,
  projectId: number
): Promise<{ created: number }> => {
  const response = await api.post(`/estimate-templates/${id}/apply`, { projectId });
  return response.data;
};
