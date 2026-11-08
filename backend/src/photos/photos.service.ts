// backend/src/photos/photos.service.ts
// ⭐ №227: фото-фиксация материалов (бэкенд-фундамент, UI — отдельная итерация №228).
// Правила:
//  • доступ — как у материала: чужая строка/объект → 404 (не раскрываем существование);
//  • добавлять фото может любой участник с правом записи (не VIEWER, не отозванный);
//  • удалять — автор, администратор объекта (CUSTOMER) или глобальный ADMIN;
//  • файлы отдаются только через API с JWT (никакой публичной статики);
//  • hidePrices фото НЕ скрывает: это подтверждение объёмов, денежных полей в ответе нет.
import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { assertAccessActive, findProjectAccess } from '../auth/access-scope';
import {
  accessibleProjectWhere,
  buildWorkScope,
  isScopeEmpty,
  loadAccessGrants,
} from '../auth/access-scope';
import { PHOTO_STORAGE } from './photo-storage';
import type { PhotoStorage } from './photo-storage';
import { buildPhotoKey } from './photo-storage';
import {
  PHOTO_MAX_BYTES,
  PHOTO_THUMB_MAX_BYTES,
  detectImageMime,
  downloadName,
  extensionForMime,
  mimeFromKey,
  parseDimension,
  parsePhotoComment,
} from './photo-validation';
import type { AllowedImageMime } from './photo-validation';

/** Файл из multer (память): нужны буфер, размер и имя. */
export interface UploadedImage {
  buffer: Buffer;
  size?: number;
  mimetype?: string;
  originalname?: string;
}

export interface PhotoListItemDto {
  id: number;
  comment: string | null;
  /** ISO-строка. */
  createdAt: string;
  authorName: string | null;
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  /** Есть ли готовая миниатюра (иначе клиент грузит полный файл). */
  hasThumb: boolean;
}

export interface PhotoFileDto {
  data: Buffer;
  mimeType: AllowedImageMime;
  fileName: string;
  cacheKey: string;
}

/** ⭐ №230: элемент ленты «последние фото» на Главной. */
export interface PhotoFeedItemDto extends PhotoListItemDto {
  materialId: number;
  materialName: string;
  projectId: number;
  projectName: string;
  objectId: number;
  objectName: string;
}

const PHOTO_SELECT = {
  id: true,
  comment: true,
  createdAt: true,
  createdById: true,
  mimeType: true,
  sizeBytes: true,
  width: true,
  height: true,
  thumbName: true,
} as const;

// ⭐ №230: те же поля + материал/проект/объект для подписи в ленте
const FEED_SELECT = {
  ...PHOTO_SELECT,
  materialId: true,
  material: {
    select: {
      name: true,
      project: {
        select: {
          id: true,
          name: true,
          object: { select: { id: true, name: true } },
        },
      },
    },
  },
} as const;

type PhotoRow = {
  id: number;
  comment: string | null;
  createdAt: Date;
  createdById: number | null;
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  thumbName: string | null;
};

@Injectable()
export class PhotosService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(PHOTO_STORAGE) private readonly storage: PhotoStorage,
  ) {}

  /** Доступ к материалу по той же модели, что в MaterialsService. */
  private async materialAccess(materialId: number, userId: number) {
    const material = await this.prisma.material.findUnique({
      where: { id: materialId },
      select: { projectId: true, project: { select: { objectId: true } } },
    });
    if (!material) throw new NotFoundException('Материал не найден');
    const access = await findProjectAccess(
      this.prisma,
      userId,
      material.project.objectId,
      material.projectId,
    );
    if (!access) throw new NotFoundException('Материал не найден');
    assertAccessActive(access);
    return access;
  }

  /** Список фото материала (свежие сверху) + имя автора. */
  async list(materialId: number, userId: number): Promise<PhotoListItemDto[]> {
    await this.materialAccess(materialId, userId);
    const rows = await this.prisma.materialPhoto.findMany({
      where: { materialId },
      orderBy: { createdAt: 'desc' },
      select: PHOTO_SELECT,
    });
    return this.withAuthors(rows);
  }

  /** Добавить имена авторов одним запросом (без N+1). */
  private async withAuthors(rows: PhotoRow[]): Promise<PhotoListItemDto[]> {
    const ids = [
      ...new Set(
        rows
          .map((r) => r.createdById)
          .filter((id): id is number => typeof id === 'number'),
      ),
    ];
    const authors = ids.length
      ? await this.prisma.user.findMany({
          where: { id: { in: ids } },
          select: { id: true, fullName: true },
        })
      : [];
    const nameById = new Map(authors.map((a) => [a.id, a.fullName]));
    return rows.map((r) => ({
      id: r.id,
      comment: r.comment,
      createdAt: r.createdAt.toISOString(),
      authorName: r.createdById ? nameById.get(r.createdById) ?? null : null,
      mimeType: r.mimeType,
      sizeBytes: r.sizeBytes,
      width: r.width,
      height: r.height,
      hasThumb: Boolean(r.thumbName),
    }));
  }

  /**
   * ⭐ №230: последние фото по всем доступным объектам (лента на Главной).
   * Доступ — как у дашборда: активные гранты, скрытые/отозванные не в счёт, архивные
   * объекты исключены (accessibleProjectWhere). hidePrices фото не скрывает — денег
   * в ответе нет, это подтверждение объёмов.
   */
  async recent(userId: number, limit = 12): Promise<PhotoFeedItemDto[]> {
    const safeLimit = Math.min(
      Math.max(Math.trunc(Number.isFinite(limit) ? limit : 12), 1),
      24,
    );
    const grants = await loadAccessGrants(this.prisma, userId);
    const scope = buildWorkScope(grants);
    if (isScopeEmpty(scope)) return [];
    const rows = await this.prisma.materialPhoto.findMany({
      where: { material: { project: accessibleProjectWhere(scope) } },
      orderBy: { createdAt: 'desc' },
      take: safeLimit,
      select: FEED_SELECT,
    });
    const base = await this.withAuthors(rows as unknown as PhotoRow[]);
    return rows.map((row, index) => ({
      ...base[index],
      materialId: row.materialId,
      materialName: row.material.name,
      projectId: row.material.project.id,
      projectName: row.material.project.name,
      objectId: row.material.project.object.id,
      objectName: row.material.project.object.name,
    }));
  }

  /** Загрузка фото (+ необязательная миниатюра 320 px) с комментарием. */
  async upload(
    materialId: number,
    userId: number,
    file: UploadedImage | undefined,
    thumb: UploadedImage | undefined,
    body: { comment?: unknown; width?: unknown; height?: unknown },
  ): Promise<PhotoListItemDto> {
    const access = await this.materialAccess(materialId, userId);
    if (access.role === 'VIEWER') {
      throw new ForbiddenException('Наблюдатель не может добавлять фото');
    }
    if (!file?.buffer?.length) {
      throw new BadRequestException('Не передан файл фото');
    }
    const size = file.size ?? file.buffer.length;
    if (size > PHOTO_MAX_BYTES) {
      throw new BadRequestException('Фото больше 10 МБ');
    }
    const mime = detectImageMime(file.buffer);
    if (!mime) {
      throw new BadRequestException('Поддерживаются только JPEG, PNG и WebP');
    }
    const comment = parsePhotoComment(body?.comment);
    const width = parseDimension(body?.width);
    const height = parseDimension(body?.height);
    const thumbnail = this.validateThumb(thumb);

    const now = new Date();
    const fileName = buildPhotoKey(now, extensionForMime(mime));
    let thumbName: string | null = null;
    await this.storage.save(fileName, file.buffer);
    try {
      if (thumbnail) {
        thumbName = buildPhotoKey(now, extensionForMime(thumbnail.mime));
        await this.storage.save(thumbName, thumbnail.buffer);
      }
      const created = await this.prisma.materialPhoto.create({
        data: {
          materialId,
          fileName,
          thumbName,
          mimeType: mime,
          sizeBytes: size,
          width,
          height,
          comment,
          createdById: userId,
        },
        select: PHOTO_SELECT,
      });
      const [dto] = await this.withAuthors([created as PhotoRow]);
      return dto;
    } catch (error) {
      // Файлы уже записаны — не оставляем мусор, если БД не приняла запись
      await this.storage.remove(fileName).catch(() => undefined);
      if (thumbName) await this.storage.remove(thumbName).catch(() => undefined);
      throw error;
    }
  }

  /** Проверка миниатюры до записи на диск (битый/огромный thumb не сохраняем). */
  private validateThumb(
    thumb: UploadedImage | undefined,
  ): { buffer: Buffer; mime: AllowedImageMime } | null {
    if (!thumb?.buffer?.length) return null;
    const size = thumb.size ?? thumb.buffer.length;
    if (size > PHOTO_THUMB_MAX_BYTES) {
      throw new BadRequestException('Миниатюра больше 2 МБ');
    }
    const mime = detectImageMime(thumb.buffer);
    if (!mime) {
      throw new BadRequestException('Миниатюра не является изображением');
    }
    return { buffer: thumb.buffer, mime };
  }

  /** Файл фото: полный или миниатюра. Чужой объект → 404. */
  async readFile(
    photoId: number,
    userId: number,
    variant: 'full' | 'thumb',
  ): Promise<PhotoFileDto> {
    const photo = await this.prisma.materialPhoto.findUnique({
      where: { id: photoId },
      select: {
        id: true,
        materialId: true,
        fileName: true,
        thumbName: true,
        mimeType: true,
      },
    });
    if (!photo) throw new NotFoundException('Фото не найдено');
    await this.materialAccess(photo.materialId, userId);

    const useThumb = variant === 'thumb' && Boolean(photo.thumbName);
    const key = useThumb ? (photo.thumbName as string) : photo.fileName;
    const mimeType = useThumb
      ? mimeFromKey(key)
      : (photo.mimeType as AllowedImageMime);
    let data: Buffer;
    try {
      data = await this.storage.read(key);
    } catch {
      throw new NotFoundException('Файл фото не найден');
    }
    return {
      data,
      mimeType,
      fileName: downloadName(photo.id, mimeType),
      cacheKey: key,
    };
  }

  /** Удаление: автор, администратор объекта (CUSTOMER) или глобальный ADMIN. */
  async remove(photoId: number, userId: number): Promise<{ ok: true }> {
    const photo = await this.prisma.materialPhoto.findUnique({
      where: { id: photoId },
      select: {
        id: true,
        materialId: true,
        fileName: true,
        thumbName: true,
        createdById: true,
      },
    });
    if (!photo) throw new NotFoundException('Фото не найдено');
    const access = await this.materialAccess(photo.materialId, userId);

    const isAuthor = photo.createdById === userId;
    const isObjectAdmin = access.role === 'CUSTOMER' && access.projectId === null;
    const globalAdmin = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    if (!isAuthor && !isObjectAdmin && globalAdmin?.role !== 'ADMIN') {
      throw new ForbiddenException(
        'Удалять фото может автор или администратор объекта',
      );
    }

    await this.prisma.materialPhoto.delete({ where: { id: photoId } });
    await this.storage.remove(photo.fileName).catch(() => undefined);
    if (photo.thumbName) {
      await this.storage.remove(photo.thumbName).catch(() => undefined);
    }
    return { ok: true };
  }
}
