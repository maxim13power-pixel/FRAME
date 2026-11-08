// frontend/src/utils/photoCompress.ts
// ⭐ №228: сжатие фото ДО загрузки (главное — не гонять 10–20 МБ с телефона).
// canvas → JPEG 1600 px q=0.8 (~250–450 КБ) + миниатюра 320 px (~20–40 КБ).
// Побочные плюсы: HEIC с iPhone превращается в JPEG, EXIF/GPS теряются,
// поворот по EXIF применяется браузером при декодировании.
export const PHOTO_MAX_SOURCE_BYTES = 20 * 1024 * 1024;
export const PHOTO_MAX_SIDE = 1600;
export const PHOTO_THUMB_SIDE = 320;
export const PHOTO_JPEG_QUALITY = 0.8;
export const PHOTO_THUMB_QUALITY = 0.75;

export interface PreparedPhoto {
  /** Основной файл (JPEG), готов к отправке. */
  file: Blob;
  /** Миниатюра 320 px (JPEG). */
  thumb: Blob;
  width: number;
  height: number;
  /** objectURL для превью — вызывающий обязан revoke. */
  previewUrl: string;
}

const loadImage = (file: Blob): Promise<{ img: HTMLImageElement; url: string }> =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve({ img, url });
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Не удалось прочитать изображение'));
    };
    img.src = url;
  });

const canvasToBlob = (canvas: HTMLCanvasElement, quality: number): Promise<Blob> =>
  new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Не удалось сжать фото'))),
      'image/jpeg',
      quality,
    );
  });

const drawScaled = (
  img: HTMLImageElement,
  maxSide: number,
  quality: number,
): Promise<{ blob: Blob; width: number; height: number }> => {
  const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  const width = Math.max(1, Math.round(img.naturalWidth * scale));
  const height = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return Promise.reject(new Error('Canvas недоступен'));
  // Прозрачный PNG → белый фон (JPEG не умеет альфу)
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);
  return canvasToBlob(canvas, quality).then((blob) => ({ blob, width, height }));
};

/**
 * Готовит фото к отправке. Больше 20 МБ — отказ (телефон отдаст RAW/панораму).
 * HEIC/HEIF: если браузер не умеет декодировать — понятная ошибка (Safari умеет).
 */
export async function preparePhoto(file: File): Promise<PreparedPhoto> {
  if (file.size > PHOTO_MAX_SOURCE_BYTES) {
    throw new Error('Файл больше 20 МБ — выберите другое фото');
  }
  const { img, url } = await loadImage(file);
  try {
    const main = await drawScaled(img, PHOTO_MAX_SIDE, PHOTO_JPEG_QUALITY);
    const thumb = await drawScaled(img, PHOTO_THUMB_SIDE, PHOTO_THUMB_QUALITY);
    return {
      file: main.blob,
      thumb: thumb.blob,
      width: main.width,
      height: main.height,
      previewUrl: URL.createObjectURL(main.blob),
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** «0,4 МБ» для подписи под превью. */
export const formatFileSize = (bytes: number): string =>
  bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} МБ`
    : `${Math.max(1, Math.round(bytes / 1024))} КБ`;
