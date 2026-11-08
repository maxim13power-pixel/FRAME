// frontend/src/services/photoService.ts
// ⭐ №228: API фото-фиксации материала (бэкенд — №227).
// Картинки грузим через axios как blob (JWT в заголовке), НЕ через <img src> с токеном в URL.
import api from './api';

export interface MaterialPhotoData {
  id: number;
  comment: string | null;
  /** ISO-строка. */
  createdAt: string;
  authorName: string | null;
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  hasThumb: boolean;
}

export const fetchMaterialPhotos = async (
  materialId: number,
): Promise<MaterialPhotoData[]> => {
  const response = await api.get(`/materials/${materialId}/photos`);
  return response.data;
};

export interface UploadPhotoPayload {
  file: Blob;
  thumb?: Blob;
  comment?: string;
  width?: number;
  height?: number;
  onProgress?: (percent: number) => void;
}

export const uploadMaterialPhoto = async (
  materialId: number,
  payload: UploadPhotoPayload,
): Promise<MaterialPhotoData> => {
  const form = new FormData();
  form.append('file', payload.file, 'photo.jpg');
  if (payload.thumb) form.append('thumb', payload.thumb, 'thumb.jpg');
  if (payload.comment?.trim()) form.append('comment', payload.comment.trim());
  if (payload.width) form.append('width', String(payload.width));
  if (payload.height) form.append('height', String(payload.height));
  const response = await api.post(`/materials/${materialId}/photos`, form, {
    // Content-Type с boundary axios выставит сам — вручную не задавать!
    onUploadProgress: (event) => {
      if (!payload.onProgress || !event.total) return;
      payload.onProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)));
    },
  });
  return response.data;
};

/** Файл фото: миниатюра (для сетки) или полный (для просмотра). */
export const fetchPhotoBlob = async (
  photoId: number,
  variant: 'thumb' | 'full' = 'thumb',
): Promise<Blob> => {
  const response = await api.get(`/materials/photos/${photoId}/file`, {
    params: { variant },
    responseType: 'blob',
  });
  return response.data;
};

export const deleteMaterialPhoto = async (photoId: number): Promise<void> => {
  await api.delete(`/materials/photos/${photoId}`);
};
