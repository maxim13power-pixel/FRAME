// backend/src/photos/photo-storage.spec.ts
// ⭐ №227: локальное хранилище — save/read/remove и защита от path traversal.
import { BadRequestException } from '@nestjs/common';
import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  LocalDiskPhotoStorage,
  buildPhotoKey,
  createPhotoStorage,
  isSafePhotoKey,
} from './photo-storage';

describe('LocalDiskPhotoStorage', () => {
  let dir: string;
  let storage: LocalDiskPhotoStorage;

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'frame-photo-'));
    storage = new LocalDiskPhotoStorage(dir);
  });

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('save → read → remove, файл лежит внутри каталога', async () => {
    const key = buildPhotoKey(new Date('2026-11-08T12:00:00.000Z'), 'jpg');
    expect(isSafePhotoKey(key)).toBe(true);
    expect(key).toMatch(/^2026\/11\/[0-9a-f-]{36}\.jpg$/);

    await storage.save(key, Buffer.from('jpeg-bytes'));
    expect((await fs.readFile(path.join(dir, key))).toString()).toBe('jpeg-bytes');
    expect((await storage.read(key)).toString()).toBe('jpeg-bytes');

    await storage.remove(key);
    await expect(storage.read(key)).rejects.toBeTruthy();
  });

  it('remove отсутствующего файла не падает', async () => {
    const key = buildPhotoKey(new Date(), 'png');
    await expect(storage.remove(key)).resolves.toBeUndefined();
  });

  it('ключи с .. или чужим форматом → 400 (path traversal)', async () => {
    const bad = [
      '../secret.jpg',
      '2026/11/../../x.jpg',
      'C:/x.jpg',
      '2026/11/not-a-uuid.jpg',
      '2026/11/00000000-0000-0000-0000-000000000000.exe',
    ];
    for (const key of bad) {
      await expect(storage.read(key)).rejects.toBeInstanceOf(BadRequestException);
      await expect(storage.save(key, Buffer.from('x'))).rejects.toBeInstanceOf(
        BadRequestException,
      );
    }
  });
});

describe('createPhotoStorage', () => {
  it('берёт PHOTO_STORAGE_DIR, иначе uploads/photos', () => {
    const custom = createPhotoStorage({
      PHOTO_STORAGE_DIR: path.join(os.tmpdir(), 'frame-photos-custom'),
    } as NodeJS.ProcessEnv);
    expect(custom).toBeInstanceOf(LocalDiskPhotoStorage);

    const fallback = createPhotoStorage({} as NodeJS.ProcessEnv);
    expect(fallback).toBeInstanceOf(LocalDiskPhotoStorage);
  });
});
