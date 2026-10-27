// frontend/src/services/objectTemplateService.ts
// ⭐ №175: шаблоны объектов (снимок структуры: проекты + позиции смет)
import api from './api';
import { parseDecimal } from '../utils/decimal';

export interface ObjectTemplateMaterialData {
  id: number;
  name: string;
  article?: string | null;
  unit: string;
  specQuantity: number;
  note?: string | null;
  priceItemId?: number | null;
  materialItemId?: number | null;
  unitPrice?: number | null;
  materialUnitPrice?: number | null;
}

export interface ObjectTemplateProjectData {
  id: number;
  name: string;
  note?: string | null;
  sortOrder: number;
  materials?: ObjectTemplateMaterialData[];
  _count?: { materials: number };
}

export interface ObjectTemplateData {
  id: number;
  name: string;
  note?: string | null;
  authorId: number;
  isPublic: boolean;
  sourceObjectId?: number | null;
  sourceObjectName?: string | null;
  createdAt: string;
  updatedAt: string;
  author?: { id: number; fullName?: string | null; email?: string | null };
  projects: ObjectTemplateProjectData[];
}

const normalizeTemplate = (t: ObjectTemplateData): ObjectTemplateData => ({
  ...t,
  projects: (t.projects ?? []).map((p) => ({
    ...p,
    materials: p.materials?.map((m) => ({
      ...m,
      specQuantity: parseDecimal(m.specQuantity),
      unitPrice: m.unitPrice == null ? m.unitPrice : parseDecimal(m.unitPrice),
      materialUnitPrice:
        m.materialUnitPrice == null ? m.materialUnitPrice : parseDecimal(m.materialUnitPrice),
    })),
  })),
});

/** Сохранить объект как шаблон */
export const createObjectTemplate = async (data: {
  objectId: number;
  name?: string;
  note?: string;
  isPublic?: boolean;
}): Promise<ObjectTemplateData> => {
  const response = await api.post('/object-templates', data);
  return normalizeTemplate(response.data);
};

/** Список шаблонов: mine — только свои, all — свои + общие */
export const fetchObjectTemplates = async (
  scope: 'mine' | 'all' = 'all',
): Promise<ObjectTemplateData[]> => {
  const response = await api.get('/object-templates', { params: { scope } });
  return (response.data as ObjectTemplateData[]).map(normalizeTemplate);
};

/** Один шаблон с позициями */
export const fetchObjectTemplate = async (id: number): Promise<ObjectTemplateData> => {
  const response = await api.get(`/object-templates/${id}`);
  return normalizeTemplate(response.data);
};

/** Переименовать / опубликовать / снять с публикации */
export const updateObjectTemplate = async (
  id: number,
  data: { name?: string; note?: string; isPublic?: boolean },
): Promise<ObjectTemplateData> => {
  const response = await api.patch(`/object-templates/${id}`, data);
  return normalizeTemplate(response.data);
};

export const deleteObjectTemplate = async (id: number): Promise<{ success: boolean }> => {
  const response = await api.delete(`/object-templates/${id}`);
  return response.data;
};

/** Создать объект из шаблона (разовая копия, без синхронизации) */
export const createObjectFromTemplate = async (
  id: number,
  data: {
    name: string;
    address: string;
    startDate: string;
    endDate: string;
    note?: string;
    role?: 'CUSTOMER' | 'FOREMAN';
  },
) => {
  const response = await api.post(`/object-templates/${id}/create-object`, data);
  return response.data;
};
