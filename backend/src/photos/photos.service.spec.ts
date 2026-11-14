// backend/src/photos/photos.service.spec.ts
// ⭐ №227: доступ (404 на чужое), права на загрузку/удаление, валидация,
// откат файлов при ошибке БД.
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PhotosService } from './photos.service';
import { PHOTO_MAX_BYTES } from './photo-validation';

const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);

const createPrisma = () => ({
  material: { findUnique: jest.fn() },
  objectAccess: { findMany: jest.fn() },
  materialPhoto: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  user: { findMany: jest.fn(), findUnique: jest.fn() },
  $transaction: jest.fn((ops: unknown[]) => Promise.all(ops)),
});
const createStorage = () => ({
  save: jest.fn(),
  read: jest.fn(),
  remove: jest.fn(),
});

describe('PhotosService', () => {
  let prisma: ReturnType<typeof createPrisma>;
  let storage: ReturnType<typeof createStorage>;
  let service: PhotosService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma = createPrisma();
    storage = createStorage();
    service = new PhotosService(prisma as any, storage as any);
    prisma.material.findUnique.mockResolvedValue({
      projectId: 10,
      project: { objectId: 5 },
    });
    prisma.objectAccess.findMany.mockResolvedValue([
      { id: 1, role: 'FOREMAN', hidePrices: false, revokedAt: null, projectId: null },
    ]);
    prisma.user.findMany.mockResolvedValue([{ id: 7, fullName: 'Пётр' }]);
    prisma.user.findUnique.mockResolvedValue({ role: 'FOREMAN' });
    prisma.materialPhoto.count.mockResolvedValue(0);
    // storage-моки должны возвращать промисы (сервис вызывает .catch на remove)
    storage.save.mockResolvedValue(undefined);
    storage.read.mockResolvedValue(Buffer.from(''));
    storage.remove.mockResolvedValue(undefined);
  });

  describe('list', () => {
    it('отдаёт ISO-дату, имя автора и hasThumb', async () => {
      prisma.materialPhoto.findMany.mockResolvedValue([
        {
          id: 3,
          comment: 'Заливка',
          createdAt: new Date('2026-11-08T10:00:00.000Z'),
          createdById: 7,
          mimeType: 'image/jpeg',
          sizeBytes: 1234,
          width: 1600,
          height: 900,
          thumbName: '2026/11/t.png',
        },
      ]);

      const res = await service.list(42, 7);

      expect(res).toEqual([
        {
          id: 3,
          comment: 'Заливка',
          createdAt: '2026-11-08T10:00:00.000Z',
          authorName: 'Пётр',
          mimeType: 'image/jpeg',
          sizeBytes: 1234,
          width: 1600,
          height: 900,
          hasThumb: true,
        },
      ]);
    });

    it('чужой материал → 404, фото не читаются', async () => {
      prisma.material.findUnique.mockResolvedValue(null);
      await expect(service.list(42, 7)).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.materialPhoto.findMany).not.toHaveBeenCalled();
    });

    it('нет доступа к объекту → 404', async () => {
      prisma.objectAccess.findMany.mockResolvedValue([]);
      await expect(service.list(42, 7)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('отозванный доступ → 403', async () => {
      prisma.objectAccess.findMany.mockResolvedValue([
        { id: 1, role: 'FOREMAN', hidePrices: false, revokedAt: new Date(), projectId: null },
      ]);
      await expect(service.list(42, 7)).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('upload', () => {
    const createdRow = {
      id: 9,
      comment: 'Бетон',
      createdAt: new Date('2026-11-08T10:00:00.000Z'),
      createdById: 7,
      mimeType: 'image/jpeg',
      sizeBytes: jpeg.length,
      width: 1600,
      height: 900,
      thumbName: '2026/11/thumb.jpg',
    };

    it('фото + миниатюра сохраняются, поля в БД корректны', async () => {
      prisma.materialPhoto.create.mockResolvedValue(createdRow);

      const res = await service.upload(
        42,
        7,
        { buffer: jpeg, size: jpeg.length },
        { buffer: jpeg, size: jpeg.length },
        { comment: ' Бетон ', width: '1600', height: '900' },
      );

      expect(storage.save).toHaveBeenCalledTimes(2);
      expect(prisma.materialPhoto.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            materialId: 42,
            mimeType: 'image/jpeg',
            comment: 'Бетон',
            width: 1600,
            height: 900,
            createdById: 7,
          }),
        }),
      );
      expect(res.id).toBe(9);
      expect(res.authorName).toBe('Пётр');
    });

    it('наблюдатель (VIEWER) не может добавлять фото', async () => {
      prisma.objectAccess.findMany.mockResolvedValue([
        { id: 1, role: 'VIEWER', hidePrices: false, revokedAt: null, projectId: null },
      ]);
      await expect(
        service.upload(42, 7, { buffer: jpeg }, undefined, {}),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(storage.save).not.toHaveBeenCalled();
    });

    it('без файла → 400', async () => {
      await expect(service.upload(42, 7, undefined, undefined, {})).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('не картинка → 400 и ничего не сохраняем', async () => {
      await expect(
        service.upload(42, 7, { buffer: Buffer.from('hello world!!') }, undefined, {}),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(storage.save).not.toHaveBeenCalled();
    });

    it('файл больше лимита → 400', async () => {
      await expect(
        service.upload(42, 7, { buffer: jpeg, size: PHOTO_MAX_BYTES + 1 }, undefined, {}),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(storage.save).not.toHaveBeenCalled();
    });

    it('ошибка БД → оба файла удаляются (откат)', async () => {
      prisma.materialPhoto.create.mockRejectedValue(new Error('db down'));
      await expect(
        service.upload(
          42,
          7,
          { buffer: jpeg, size: jpeg.length },
          { buffer: jpeg, size: jpeg.length },
          {},
        ),
      ).rejects.toThrow('db down');
      expect(storage.remove).toHaveBeenCalledTimes(2);
    });
  });

  describe('readFile', () => {
    const photo = {
      id: 3,
      materialId: 42,
      fileName: '2026/11/full.jpg',
      thumbName: null as string | null,
      mimeType: 'image/jpeg',
    };

    it('нет фото → 404', async () => {
      prisma.materialPhoto.findUnique.mockResolvedValue(null);
      await expect(service.readFile(3, 7, 'full')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('чужой объект → 404 (файл не читается)', async () => {
      prisma.materialPhoto.findUnique.mockResolvedValue(photo);
      prisma.objectAccess.findMany.mockResolvedValue([]);
      await expect(service.readFile(3, 7, 'full')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(storage.read).not.toHaveBeenCalled();
    });

    it('полный файл: mime и имя для скачивания', async () => {
      prisma.materialPhoto.findUnique.mockResolvedValue(photo);
      storage.read.mockResolvedValue(Buffer.from('bytes'));

      const res = await service.readFile(3, 7, 'full');

      expect(storage.read).toHaveBeenCalledWith('2026/11/full.jpg');
      expect(res.mimeType).toBe('image/jpeg');
      expect(res.fileName).toBe('photo-3.jpg');
    });

    it('миниатюры нет → отдаём полный файл (variant=thumb не ломает)', async () => {
      prisma.materialPhoto.findUnique.mockResolvedValue(photo);
      storage.read.mockResolvedValue(Buffer.from('bytes'));

      await service.readFile(3, 7, 'thumb');

      expect(storage.read).toHaveBeenCalledWith('2026/11/full.jpg');
    });

    it('миниатюра есть → отдельный ключ и mime по расширению', async () => {
      prisma.materialPhoto.findUnique.mockResolvedValue({
        ...photo,
        thumbName: '2026/11/small.webp',
      });
      storage.read.mockResolvedValue(Buffer.from('thumb'));

      const res = await service.readFile(3, 7, 'thumb');

      expect(storage.read).toHaveBeenCalledWith('2026/11/small.webp');
      expect(res.mimeType).toBe('image/webp');
    });
  });

  describe('remove', () => {
    const photo = {
      id: 3,
      materialId: 42,
      fileName: '2026/11/full.jpg',
      thumbName: '2026/11/small.jpg',
      createdById: 99,
    };

    it('не автор и не админ → 403', async () => {
      prisma.materialPhoto.findUnique.mockResolvedValue(photo);
      await expect(service.remove(3, 7)).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.materialPhoto.delete).not.toHaveBeenCalled();
    });

    it('автор удаляет: запись и оба файла', async () => {
      prisma.materialPhoto.findUnique.mockResolvedValue({ ...photo, createdById: 7 });

      await expect(service.remove(3, 7)).resolves.toEqual({ ok: true });

      expect(prisma.materialPhoto.delete).toHaveBeenCalledWith({ where: { id: 3 } });
      expect(storage.remove).toHaveBeenCalledWith('2026/11/full.jpg');
      expect(storage.remove).toHaveBeenCalledWith('2026/11/small.jpg');
    });

    it('администратор объекта (CUSTOMER) удаляет чужое фото', async () => {
      prisma.materialPhoto.findUnique.mockResolvedValue(photo);
      prisma.objectAccess.findMany.mockResolvedValue([
        { id: 1, role: 'CUSTOMER', hidePrices: false, revokedAt: null, projectId: null },
      ]);

      await expect(service.remove(3, 7)).resolves.toEqual({ ok: true });
      expect(prisma.materialPhoto.delete).toHaveBeenCalled();
    });

    it('глобальный ADMIN удаляет чужое фото', async () => {
      prisma.materialPhoto.findUnique.mockResolvedValue(photo);
      prisma.user.findUnique.mockResolvedValue({ role: 'ADMIN' });

      await expect(service.remove(3, 7)).resolves.toEqual({ ok: true });
    });

    it('нет фото → 404', async () => {
      prisma.materialPhoto.findUnique.mockResolvedValue(null);
      await expect(service.remove(3, 7)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('recent — лента фото на Главной (№230)', () => {
    const feedRow = {
      id: 5,
      comment: 'Бетон залит',
      createdAt: new Date('2026-11-08T10:00:00.000Z'),
      createdById: 7,
      mimeType: 'image/jpeg',
      sizeBytes: 1234,
      width: 1600,
      height: 900,
      thumbName: null,
      materialId: 42,
      material: {
        name: 'Бетон М300',
        project: { id: 10, name: 'Проект А', object: { id: 5, name: 'Объект А' } },
      },
    };

    it('отдаёт фото с подписями материала/проекта/объекта', async () => {
      prisma.materialPhoto.findMany.mockResolvedValue([feedRow]);

      const res = await service.recent(7, 12);

      expect(res).toHaveLength(1);
      expect(res[0]).toEqual({
        id: 5,
        comment: 'Бетон залит',
        createdAt: '2026-11-08T10:00:00.000Z',
        authorName: 'Пётр',
        mimeType: 'image/jpeg',
        sizeBytes: 1234,
        width: 1600,
        height: 900,
        hasThumb: false,
        materialId: 42,
        materialName: 'Бетон М300',
        projectId: 10,
        projectName: 'Проект А',
        objectId: 5,
        objectName: 'Объект А',
      });
    });

    it('recentWithTotal: точный total и лимит до 500 (№256)', async () => {
      prisma.materialPhoto.findMany.mockResolvedValue([feedRow]);
      prisma.materialPhoto.count.mockResolvedValue(42);

      const res = await service.recentWithTotal(7, 500);

      expect(res.total).toBe(42);
      expect(res.items).toHaveLength(1);
      expect(prisma.materialPhoto.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 500 }),
      );
    });

    it('нет объектов — пустая лента, БД не дёргаем', async () => {
      prisma.objectAccess.findMany.mockResolvedValue([]);

      await expect(service.recent(7)).resolves.toEqual([]);
      expect(prisma.materialPhoto.findMany).not.toHaveBeenCalled();
    });

    it('limit зажимается в 1..24', async () => {
      prisma.materialPhoto.findMany.mockResolvedValue([]);
      await service.recent(7, 100);
      expect(prisma.materialPhoto.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 24 }),
      );

      prisma.materialPhoto.findMany.mockClear();
      await service.recent(7, 0);
      expect(prisma.materialPhoto.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 1 }),
      );
    });

    it('наблюдатель с hidePrices фото видит (деньги здесь не отдаются)', async () => {
      prisma.objectAccess.findMany.mockResolvedValue([
        { id: 1, role: 'VIEWER', hidePrices: true, revokedAt: null, projectId: null },
      ]);
      prisma.materialPhoto.findMany.mockResolvedValue([feedRow]);

      const res = await service.recent(7, 12);

      expect(res).toHaveLength(1);
    });

    it('отозванный доступ в ленту не попадает', async () => {
      prisma.objectAccess.findMany.mockResolvedValue([
        { id: 1, role: 'FOREMAN', hidePrices: false, revokedAt: new Date(), projectId: null },
      ]);

      await expect(service.recent(7)).resolves.toEqual([]);
      expect(prisma.materialPhoto.findMany).not.toHaveBeenCalled();
    });
  });
});
