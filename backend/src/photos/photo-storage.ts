// backend/src/photos/photo-storage.ts
// ⭐ №227: хранилище фото за интерфейсом. Сейчас — локальный диск (volume),
// позже S3 (Timeweb) без изменения сервиса. Ключи генерируем сами:
// YYYY/MM/<uuid>.<ext> — никаких имён от клиента и никаких «..».
import { BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import * as path from 'path';

export interface PhotoStorage {
  /** Сохранить файл по ключу (каталоги создаются автоматически). */
  save(key: string, data: Buffer): Promise<void>;
  /** Прочитать файл; ENOENT пробрасывается как есть (сервис отдаёт 404). */
  read(key: string): Promise<Buffer>;
  /** Удалить файл; отсутствующий файл — не ошибка. */
  remove(key: string): Promise<void>;
}

export const PHOTO_STORAGE = 'PHOTO_STORAGE';

/** Ключ, который мы сами сгенерировали: YYYY/MM/uuid.jpg|png|webp */
const KEY_PATTERN = /^\d{4}\/\d{2}\/[0-9a-f-]{36}\.(jpg|png|webp)$/;

export function isSafePhotoKey(key: string): boolean {
  return KEY_PATTERN.test(key);
}

/** Ключ для нового файла: 2026/11/<uuid>.jpg */
export function buildPhotoKey(now: Date, extension: string): string {
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const ext = extension.replace(/[^a-z]/gi, '').toLowerCase() || 'jpg';
  return `${year}/${month}/${randomUUID()}.${ext}`;
}

export class LocalDiskPhotoStorage implements PhotoStorage {
  constructor(private readonly baseDir: string) {}

  /** Абсолютный путь внутри baseDir; всё остальное — 400 (path traversal). */
  private resolveKey(key: string): string {
    if (!isSafePhotoKey(key)) {
      throw new BadRequestException('Недопустимый ключ файла');
    }
    const base = path.resolve(this.baseDir);
    const full = path.resolve(base, key);
    if (full !== base && !full.startsWith(base + path.sep)) {
      throw new BadRequestException('Недопустимый ключ файла');
    }
    return full;
  }

  async save(key: string, data: Buffer): Promise<void> {
    const full = this.resolveKey(key);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, data);
  }

  async read(key: string): Promise<Buffer> {
    return fs.readFile(this.resolveKey(key));
  }

  async remove(key: string): Promise<void> {
    await fs.rm(this.resolveKey(key), { force: true });
  }
}

/** Фабрика: PHOTO_STORAGE_DIR (volume) или backend/uploads/photos по умолчанию. */
export function createPhotoStorage(
  env: NodeJS.ProcessEnv = process.env,
): PhotoStorage {
  const dir = env.PHOTO_STORAGE_DIR?.trim();
  const baseDir = dir && dir.length > 0
    ? path.resolve(dir)
    : path.resolve(process.cwd(), 'uploads', 'photos');
  return new LocalDiskPhotoStorage(baseDir);
}
