// backend/src/photos/photo-validation.ts
// ⭐ №227: проверки фото-файлов. Расширению и Content-Type от клиента НЕ верим —
// определяем формат по magic bytes (iPhone/Android присылают что угодно).
import { BadRequestException } from '@nestjs/common';

/** Лимит одного фото до сжатия на клиенте (после сжатия обычно 200–400 КБ). */
export const PHOTO_MAX_BYTES = 10 * 1024 * 1024;
/** Миниатюра 320 px — отдельный, более жёсткий лимит. */
export const PHOTO_THUMB_MAX_BYTES = 2 * 1024 * 1024;
/** Комментарий к фото — не длиннее 500 символов (колонка VARCHAR(500)). */
export const PHOTO_COMMENT_MAX = 500;
/** Разумные границы сторон в пикселях (защита от мусора в теле запроса). */
const MAX_DIMENSION = 20000;

export type AllowedImageMime = 'image/jpeg' | 'image/png' | 'image/webp';

const EXT_BY_MIME: Record<AllowedImageMime, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

const MIME_BY_EXT: Record<string, AllowedImageMime> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

/** Формат картинки по первым байтам; null — не поддерживаем (SVG/GIF/HEIC и т.п.). */
export function detectImageMime(buffer: Buffer | undefined): AllowedImageMime | null {
  if (!buffer || buffer.length < 12) return null;
  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'image/png';
  }
  // WebP: RIFF....WEBP
  if (
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'image/webp';
  }
  return null;
}

export function extensionForMime(mime: AllowedImageMime): string {
  return EXT_BY_MIME[mime];
}

/** MIME по расширению ключа (для миниатюр, у которых не храним отдельный mimeType). */
export function mimeFromKey(key: string): AllowedImageMime {
  const ext = key.slice(key.lastIndexOf('.') + 1).toLowerCase();
  return MIME_BY_EXT[ext] ?? 'image/jpeg';
}

/**
 * Комментарий: trim, пустой → null, длиннее 500 → 400 (а не молчаливая обрезка,
 * чтобы пользователь не терял текст).
 */
export function parsePhotoComment(raw: unknown): string | null {
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== 'string') throw new BadRequestException('Комментарий должен быть строкой');
  const text = raw.trim();
  if (!text) return null;
  if (text.length > PHOTO_COMMENT_MAX) {
    throw new BadRequestException(
      `Комментарий не длиннее ${PHOTO_COMMENT_MAX} символов`,
    );
  }
  return text;
}

/** Ширина/высота из multipart (строки) — целое 1..20000 или null. */
export function parseDimension(raw: unknown): number | null {
  if (raw === undefined || raw === null || raw === '') return null;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0 || value > MAX_DIMENSION) return null;
  return value;
}

/** Имя файла для скачивания: без пробелов и кавычек, расширение по MIME. */
export function downloadName(photoId: number, mime: AllowedImageMime): string {
  return `photo-${photoId}.${EXT_BY_MIME[mime]}`;
}
