// backend/src/price-list/price-list.service.ts
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PriceKind, Unit } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service'; // ⭐ №131
import { canWriteWithRole, loadCatalogAccess } from './catalog-access'; // ⭐ №164
import { resolveObjectRole, resolveProjectRole } from '../auth/access-scope'; // ⭐ №164
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { CreatePriceItemDto } from './dto/create-price-item.dto';

@Injectable()
export class PriceListService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService, // ⭐ №131
  ) {}

  // ⭐ Хелпер: фильтр расценок — ОБЩИЕ (ownerId=null) + ЛИЧНЫЕ текущего юзера.
  // Общий стартовый справочник виден всем; личный — только владельцу (ТЗ 3.7).
  private ownerFilter(userId?: number) {
    return userId
      ? { OR: [{ ownerId: null }, { ownerId: userId }] }
      : { ownerId: null };
  }

  // ⭐ №151: системный (демо) справочник — есть всегда, доступен всем
  private async ensureSystemCatalog() {
    const existing = await this.prisma.priceCatalog.findFirst({
      where: { ownerId: null },
      orderBy: { id: 'asc' },
    });
    if (existing) return existing;
    return this.prisma.priceCatalog.create({
      data: { name: 'Демо-справочник', ownerId: null },
    });
  }

  // ⭐ №151: личный справочник пользователя (создаётся при первом обращении)
  private async ensurePersonalCatalog(userId: number) {
    const existing = await this.prisma.priceCatalog.findFirst({
      where: { ownerId: userId },
      orderBy: { id: 'asc' },
    });
    if (existing) return existing;
    return this.prisma.priceCatalog.create({
      data: { name: 'Личный справочник', ownerId: userId },
    });
  }

  private async isAdmin(userId?: number) {
    if (!userId) return false;
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    return user?.role === 'ADMIN';
  }

  // ⭐ №151: справочник, доступный пользователю (системный, свой, объектный/проектный — №164)
  private async resolveCatalog(catalogId: number | undefined, userId?: number) {
    if (catalogId) {
      const catalog = await this.prisma.priceCatalog.findUnique({
        where: { id: catalogId },
      });
      if (!catalog) throw new NotFoundException('Справочник не найден или нет доступа');
      if (
        catalog.ownerId !== null &&
        catalog.ownerId !== userId &&
        !(await this.canReadCatalog(catalogId, userId))
      ) {
        throw new NotFoundException('Справочник не найден или нет доступа');
      }
      return catalog;
    }
    // без явного выбора: личный справочник юзера, иначе системный
    return userId ? this.ensurePersonalCatalog(userId) : this.ensureSystemCatalog();
  }

  // ⭐ №151/№164: справочники, доступные пользователю.
  // Системные + свои + объектные/проектные (привязка к объектам, где есть доступ).
  async listCatalogs(userId?: number) {
    const catalogs = await this.prisma.priceCatalog.findMany({
      where: {
        isArchived: false,
        OR: [
          { ownerId: null },
          ...(userId
            ? [
                { ownerId: userId },
                { objects: { some: { accesses: { some: { userId } } } } },
                {
                  projects: {
                    some: { object: { accesses: { some: { userId } } } },
                  },
                },
              ]
            : []),
        ],
      },
      orderBy: [{ ownerId: 'asc' }, { name: 'asc' }],
      include: {
        _count: { select: { items: true, projects: true, objects: true } },
        objects: { select: { id: true, name: true }, orderBy: { id: 'asc' } },
        projects: {
          select: { id: true, name: true, objectId: true },
          orderBy: { id: 'asc' },
        },
      },
    });

    const isAdmin = await this.isAdmin(userId);
    const grants = userId
      ? await this.prisma.objectAccess.findMany({
          where: { userId },
          select: {
            objectId: true,
            projectId: true,
            role: true,
            hidePrices: true,
          },
        })
      : [];

    return catalogs.map((c) => {
      const isSystem = c.ownerId === null;
      const scope: 'system' | 'object' | 'project' | 'personal' = isSystem
        ? 'system'
        : c.projects.length > 0
          ? 'project'
          : c.objects.length > 0
            ? 'object'
            : 'personal';
      const canWrite =
        isAdmin ||
        (!!userId && c.ownerId === userId) ||
        // системный справочник правит только ADMIN (привязка к объекту не даёт прав)
        (!isSystem &&
          (c.objects.some((o) =>
            canWriteWithRole(resolveObjectRole(grants, o.id).role),
          ) ||
            c.projects.some((p) =>
              canWriteWithRole(resolveProjectRole(grants, p.objectId, p.id)),
            )));
      return {
        id: c.id,
        name: c.name,
        ownerId: c.ownerId,
        isSystem,
        scope,
        objectId: c.objects[0]?.id ?? null,
        objectName: c.objects[0]?.name ?? null,
        projectId: c.projects[0]?.id ?? null,
        projectName: c.projects[0]?.name ?? null,
        itemsCount: c._count.items,
        projectsCount: c._count.projects,
        objectsCount: c._count.objects,
        canWrite,
        createdAt: c.createdAt,
      };
    });
  }

  // ⭐ №151/№164: создать справочник. Без opts — личный; с objectId/projectId —
  // сразу привязать к объекту (или проекту — проект перекрывает объект).
  async createCatalog(
    name: string,
    userId: number,
    opts: { objectId?: number; projectId?: number } = {},
  ) {
    const trimmed = name.trim();
    if (!trimmed) throw new BadRequestException('Название справочника обязательно');

    let objectId: number | null = null;
    if (opts.projectId) {
      const project = await this.prisma.project.findUnique({
        where: { id: opts.projectId },
        select: { id: true, objectId: true },
      });
      if (!project) throw new NotFoundException('Проект не найден');
      objectId = project.objectId;
    } else if (opts.objectId) {
      const object = await this.prisma.object.findUnique({
        where: { id: opts.objectId },
        select: { id: true },
      });
      if (!object) throw new NotFoundException('Объект не найден');
      objectId = object.id;
    }

    // В справочник объекта/проекта пишут заказчик и прораб (решение 10.1(2))
    if (objectId) {
      const grants = await this.prisma.objectAccess.findMany({
        where: { userId, objectId },
        select: { objectId: true, projectId: true, role: true, hidePrices: true },
      });
      const role = opts.projectId
        ? resolveProjectRole(grants, objectId, opts.projectId)
        : resolveObjectRole(grants, objectId).role;
      if (!canWriteWithRole(role)) {
        throw new ForbiddenException(
          'Менять справочник объекта может только заказчик или прораб',
        );
      }
    }

    const duplicate = await this.prisma.priceCatalog.findFirst({
      where: { ownerId: userId, name: trimmed, isArchived: false },
    });
    if (duplicate) throw new BadRequestException('Справочник с таким названием уже есть');

    const created = await this.prisma.priceCatalog.create({
      data: { name: trimmed, ownerId: userId },
    });

    if (opts.projectId) {
      await this.prisma.project.update({
        where: { id: opts.projectId },
        data: { catalogId: created.id },
      });
    } else if (objectId) {
      await this.prisma.object.update({
        where: { id: objectId },
        data: { catalogId: created.id },
      });
    }

    return {
      ...created,
      scope: objectId ? (opts.projectId ? 'project' : 'object') : 'personal',
      objectId: objectId ?? null,
      projectId: opts.projectId ?? null,
      itemsCount: 0,
      canWrite: true,
    };
  }

  // ⭐ №164: «поделиться» справочником = скопировать его активные расценки
  // в новый справочник объекта или проекта (отдельной модели шаринга не вводим).
  async copyCatalog(
    sourceId: number,
    userId: number,
    dto: { name?: string; objectId?: number; projectId?: number },
  ) {
    const access = await loadCatalogAccess(this.prisma, sourceId, userId);
    if (!access || !access.canRead) {
      throw new NotFoundException('Справочник не найден или нет доступа');
    }
    const items = await this.prisma.priceItem.findMany({
      where: { catalogId: sourceId, isActive: true },
      orderBy: { name: 'asc' },
    });

    const name = dto.name?.trim() || `Копия «${access.catalog.name}»`;
    const created = await this.createCatalog(name, userId, {
      objectId: dto.objectId,
      projectId: dto.projectId,
    });

    if (items.length > 0) {
      await this.prisma.priceItem.createMany({
        data: items.map((i) => ({
          name: i.name,
          article: i.article,
          unit: i.unit,
          price: i.price,
          categoryId: i.categoryId,
          kind: i.kind,
          isActive: true,
          catalogId: created.id,
          ownerId: created.ownerId, // владелец расценки = владелец нового справочника
        })),
      });
    }

    await this.audit.log(userId, 'price_catalog', created.id, 'copy', {
      sourceCatalogId: sourceId,
      items: items.length,
    });

    return { ...created, itemsCount: items.length };
  }

  // ⭐ №151/№164: переименовать справочник — владелец, ADMIN, заказчик/прораб объекта
  async updateCatalog(id: number, name: string, userId?: number) {
    const access = await loadCatalogAccess(this.prisma, id, userId);
    if (!access) throw new NotFoundException('Справочник не найден');
    if (!access.canWrite) {
      throw new ForbiddenException(
        access.catalog.ownerId === null
          ? 'Системный справочник может изменять только владелец системы'
          : 'Нет прав на изменение этого справочника',
      );
    }
    const trimmed = name.trim();
    if (!trimmed) throw new BadRequestException('Название справочника обязательно');
    return this.prisma.priceCatalog.update({ where: { id }, data: { name: trimmed } });
  }

  // ⭐ №151/№164: архивировать справочник (данные не удаляем — история смет сохраняется)
  async archiveCatalog(id: number, userId?: number) {
    const access = await loadCatalogAccess(this.prisma, id, userId);
    if (!access) throw new NotFoundException('Справочник не найден');
    if (!access.canWrite) {
      throw new ForbiddenException(
        access.catalog.ownerId === null
          ? 'Системный справочник может изменять только владелец системы'
          : 'Нет прав на изменение этого справочника',
      );
    }
    return this.prisma.priceCatalog.update({ where: { id }, data: { isArchived: true } });
  }

  // Все категории (для селектов). Категории ОБЩИЕ — без владельца.
  async getCategories(kind?: string, userId?: number) {
    return this.prisma.priceCategory.findMany({
      where: {
        ...(kind ? { kind: kind as PriceKind } : {}),
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  // Категории с активными расценками (общие + личные юзера; в справочнике — все его расценки)
  async getCategoriesWithItems(kind?: string, userId?: number, catalogId?: number) {
    if (catalogId) {
      const access = await loadCatalogAccess(this.prisma, catalogId, userId);
      if (!access || !access.canRead) {
        throw new NotFoundException('Справочник не найден или нет доступа');
      }
    }
    return this.prisma.priceCategory.findMany({
      where: {
        ...(kind ? { kind: kind as PriceKind } : {}),
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: {
        items: {
          where: {
            isActive: true,
            ...(kind ? { kind: kind as PriceKind } : {}),
            ...(catalogId ? { catalogId } : this.ownerFilter(userId)),
          },
          orderBy: { name: 'asc' },
        },
      },
    });
  }

  // ⭐ №159: может ли пользователь читать расценки справочника: системный — всем,
  // свой — владельцу, чужой личный — участникам проекта, к которому он привязан.
  private async canReadCatalog(catalogId: number, userId?: number) {
    const catalog = await this.prisma.priceCatalog.findUnique({
      where: { id: catalogId },
      select: { ownerId: true },
    });
    if (!catalog) return false;
    if (catalog.ownerId === null || catalog.ownerId === userId) return true;
    if (!userId) return false;
    // ⭐ №164: объектный справочник читают все участники объекта
    const asObject = await this.prisma.object.findFirst({
      where: { catalogId, accesses: { some: { userId } } },
      select: { id: true },
    });
    if (asObject) return true;
    const linked = await this.prisma.project.findFirst({
      where: {
        catalogId,
        object: { accesses: { some: { userId } } },
      },
      select: { id: true },
    });
    return !!linked;
  }
  // Поиск расценок (для Autocomplete в материалах): общие + личные юзера.
  // ⭐ Через явный AND, чтобы OR владельца и OR поиска не затёрли друг друга.
  async searchItems(
    search?: string,
    categoryId?: number,
    kind?: string,
    userId?: number,
    catalogId?: number,
  ) {
    // ⭐ №159: смета ищет в справочнике проекта — проверяем, что он доступен пользователю
    if (catalogId && !(await this.canReadCatalog(catalogId, userId))) {
      throw new NotFoundException('Справочник не найден или нет доступа');
    }
    return this.prisma.priceItem.findMany({
      where: {
        AND: [
          { isActive: true },
          ...(kind ? [{ kind: kind as PriceKind }] : []),
          ...(categoryId ? [{ categoryId }] : []),
          ...(catalogId ? [{ catalogId }] : [this.ownerFilter(userId)]),
          ...(search
            ? [
                {
                  OR: [
                    {
                      name: { contains: search, mode: 'insensitive' as const },
                    },
                    {
                      article: {
                        contains: search,
                        mode: 'insensitive' as const,
                      },
                    },
                  ],
                },
              ]
            : []),
        ],
      },
      include: { category: true },
      orderBy: { name: 'asc' },
      take: 20,
    });
  }

  // Создание категории (общая — без владельца)
  async createCategory(dto: CreateCategoryDto, userId?: number) {
    return this.prisma.priceCategory.create({
      data: {
        name: dto.name.trim(),
        sortOrder: dto.sortOrder ?? 0,
        kind: (dto.kind as PriceKind) ?? 'WORK',
      },
    });
  }

  // Переименование категории (категории общие)
  async updateCategory(id: number, dto: UpdateCategoryDto, userId?: number) {
    const category = await this.prisma.priceCategory.findFirst({
      where: { id },
    });
    if (!category) throw new NotFoundException('Категория не найдена');
    return this.prisma.priceCategory.update({
      where: { id },
      data: { name: dto.name.trim() },
    });
  }

  // Удаление категории — ТОЛЬКО если в ней нет АКТИВНЫХ расценок
  // (иначе Cascade удалил бы расценки, а нам это не надо)
  async removeCategory(id: number, userId?: number) {
    const category = await this.prisma.priceCategory.findFirst({
      where: { id },
      include: {
        _count: {
          select: {
            items: { where: { isActive: true } },
          },
        },
      },
    });
    if (!category) throw new NotFoundException('Категория не найдена');
    if (category._count.items > 0) {
      throw new BadRequestException(
        'Нельзя удалить категорию: в ней есть расценки. Сначала удалите или перенесите их.',
      );
    }
    return this.prisma.priceCategory.delete({ where: { id } });
  }

  // Создание расценки → в выбранный справочник (по умолчанию — личный справочник юзера)
  async createItem(dto: CreatePriceItemDto, userId?: number) {
    // Проверяем что категория существует (категории общие)
    const category = await this.prisma.priceCategory.findFirst({
      where: { id: dto.categoryId },
    });
    if (!category) throw new NotFoundException('Категория не найдена');

    const catalog = await this.resolveCatalog(dto.catalogId, userId);
    // ⭐ №164: писать можно в свой, системный (ADMIN) и в справочник объекта/проекта
    // (заказчик/прораб). Проверка — общая для всех входов.
    const access = await loadCatalogAccess(this.prisma, catalog.id, userId);
    if (!access || !access.canRead) {
      throw new NotFoundException('Справочник не найден или нет доступа');
    }
    if (!access.canWrite) {
      throw new ForbiddenException(
        catalog.ownerId === null
          ? 'В системный справочник может добавлять только владелец системы. Выберите свой справочник.'
          : 'Нет прав на изменение этого справочника',
      );
    }

    return this.prisma.priceItem.create({
      data: {
        name: dto.name.trim(),
        article: dto.article?.trim() || null,
        unit: (dto.unit ?? 'PIECE') as Unit,
        price: dto.price,
        categoryId: dto.categoryId,
        kind: (dto.kind as PriceKind) ?? 'WORK',
        catalogId: catalog.id, // ⭐ №151
        ownerId: catalog.ownerId, // ⭐ владелец расценки = владелец справочника
      },
    });
  }

  // ⭐ №164: право менять расценку определяет справочник, в котором она лежит:
  // системный — ADMIN, личный — владелец, объектный/проектный — заказчик/прораб.
  private async assertCanEditItem(catalogId: number, userId?: number) {
    const access = await loadCatalogAccess(this.prisma, catalogId, userId);
    if (!access) throw new NotFoundException('Расценка не найдена или нет доступа');
    if (access.canWrite) return;
    if (access.catalog.ownerId === null) {
      throw new ForbiddenException(
        'Общие расценки может изменять только владелец системы. Создайте личную расценку — она доступна только вам.',
      );
    }
    throw new ForbiddenException('Нет прав на изменение расценок этого справочника');
  }

  // Обновление расценки: свои — свободно, общие — только ADMIN
  async updateItem(
    id: number,
    dto: Partial<CreatePriceItemDto>,
    userId?: number,
  ) {
    const item = await this.prisma.priceItem.findUnique({ where: { id } });
    if (!item)
      throw new NotFoundException('Расценка не найдена или нет доступа');
    await this.assertCanEditItem(item.catalogId, userId);
    const updated = await this.prisma.priceItem.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name?.trim() }),
        ...(dto.article !== undefined && {
          article: dto.article?.trim() || null,
        }),
        ...(dto.unit != null && { unit: dto.unit as Unit }),
        ...(dto.price !== undefined && { price: dto.price }),
      },
    });

    // ⭐ №131: журнал изменения расценки
    if (userId) {
      if (dto.price !== undefined && Number(dto.price) !== Number(item.price)) {
        await this.audit.log(
          userId,
          'price_item',
          id,
          'price_change',
          { price: Number(item.price) },
          { price: Number(updated.price) },
        );
      } else if (dto.name !== undefined || dto.unit != null) {
        await this.audit.log(
          userId,
          'price_item',
          id,
          'update',
          { name: item.name, unit: item.unit },
          { name: updated.name, unit: updated.unit },
        );
      }
    }

    return updated;
  }

  // Не удаляем, а деактивируем — старые сметы остаются нетронутыми.
  // Можно деактивировать расценки своего справочника и справочника объекта/проекта.
  async removeItem(id: number, userId?: number) {
    const item = await this.prisma.priceItem.findUnique({ where: { id } });
    if (!item)
      throw new NotFoundException('Расценка не найдена или нет доступа');
    await this.assertCanEditItem(item.catalogId, userId);
    const updated = await this.prisma.priceItem.update({
      where: { id },
      data: { isActive: false },
    });
    // ⭐ №131: журнал удаления расценки
    if (userId) {
      await this.audit.log(userId, 'price_item', id, 'delete', {
        name: item.name,
        price: Number(item.price),
      });
    }
    return updated;
  }
}
