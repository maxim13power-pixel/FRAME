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

  // ⭐ №151: справочник, доступный пользователю (системный или свой)
  private async resolveCatalog(catalogId: number | undefined, userId?: number) {
    if (catalogId) {
      const catalog = await this.prisma.priceCatalog.findFirst({
        where: {
          id: catalogId,
          ...(userId ? { OR: [{ ownerId: null }, { ownerId: userId }] } : {}),
        },
      });
      if (!catalog) throw new NotFoundException('Справочник не найден или нет доступа');
      return catalog;
    }
    // без явного выбора: личный справочник юзера, иначе системный
    return userId ? this.ensurePersonalCatalog(userId) : this.ensureSystemCatalog();
  }

  // ⭐ №151: список справочников, доступных пользователю (системные + свои)
  async listCatalogs(userId?: number) {
    const catalogs = await this.prisma.priceCatalog.findMany({
      where: {
        isArchived: false,
        ...(userId ? { OR: [{ ownerId: null }, { ownerId: userId }] } : { ownerId: null }),
      },
      orderBy: [{ ownerId: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { items: true, projects: true } } },
    });
    return catalogs.map((c) => ({
      id: c.id,
      name: c.name,
      ownerId: c.ownerId,
      isSystem: c.ownerId === null,
      itemsCount: c._count.items,
      projectsCount: c._count.projects,
      createdAt: c.createdAt,
    }));
  }

  // ⭐ №151: создать справочник (личный для пользователя)
  async createCatalog(name: string, userId: number) {
    const trimmed = name.trim();
    if (!trimmed) throw new BadRequestException('Название справочника обязательно');
    const duplicate = await this.prisma.priceCatalog.findFirst({
      where: { ownerId: userId, name: trimmed, isArchived: false },
    });
    if (duplicate) throw new BadRequestException('Справочник с таким названием уже есть');
    return this.prisma.priceCatalog.create({ data: { name: trimmed, ownerId: userId } });
  }

  // ⭐ №151: переименовать справочник (свой — свободно, системный — только ADMIN)
  async updateCatalog(id: number, name: string, userId?: number) {
    const catalog = await this.prisma.priceCatalog.findUnique({ where: { id } });
    if (!catalog) throw new NotFoundException('Справочник не найден');
    if (catalog.ownerId === null) {
      if (!(await this.isAdmin(userId))) {
        throw new ForbiddenException('Системный справочник может изменять только владелец системы');
      }
    } else if (catalog.ownerId !== userId) {
      throw new ForbiddenException('Это чужой справочник');
    }
    const trimmed = name.trim();
    if (!trimmed) throw new BadRequestException('Название справочника обязательно');
    return this.prisma.priceCatalog.update({ where: { id }, data: { name: trimmed } });
  }

  // ⭐ №151: архивировать справочник (данные не удаляем — история смет сохраняется)
  async archiveCatalog(id: number, userId?: number) {
    const catalog = await this.prisma.priceCatalog.findUnique({ where: { id } });
    if (!catalog) throw new NotFoundException('Справочник не найден');
    if (catalog.ownerId === null) {
      if (!(await this.isAdmin(userId))) {
        throw new ForbiddenException('Системный справочник может изменять только владелец системы');
      }
    } else if (catalog.ownerId !== userId) {
      throw new ForbiddenException('Это чужой справочник');
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

  // Категории с активными расценками (общие + личные юзера)
  async getCategoriesWithItems(kind?: string, userId?: number, catalogId?: number) {
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
            ...(catalogId ? { catalogId } : {}),
            ...this.ownerFilter(userId),
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
    // ⭐ В системный справочник пишет только ADMIN, остальные — в свой
    if (catalog.ownerId === null && !(await this.isAdmin(userId))) {
      throw new ForbiddenException(
        'В системный справочник может добавлять только владелец системы. Выберите свой справочник.',
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

  // ⭐ Общие (демо) расценки правит только владелец системы (ADMIN).
  // Личные расценки доступны владельцу через ownerFilter, поэтому здесь проверяем только общие.
  private async assertCanEditShared(itemOwnerId: number | null, userId?: number) {
    if (itemOwnerId !== null) return;
    if (!userId) return;
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    if (user?.role !== 'ADMIN') {
      throw new ForbiddenException(
        'Общие расценки может изменять только владелец системы. Создайте личную расценку — она доступна только вам.',
      );
    }
  }

  // Обновление расценки: свои — свободно, общие — только ADMIN
  async updateItem(
    id: number,
    dto: Partial<CreatePriceItemDto>,
    userId?: number,
  ) {
    const item = await this.prisma.priceItem.findFirst({
      where: { id, ...this.ownerFilter(userId) },
    });
    if (!item)
      throw new NotFoundException('Расценка не найдена или нет доступа');
    await this.assertCanEditShared(item.ownerId, userId);
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
  // Можно деактивировать ОБЩИЕ и СВОИ расценки.
  async removeItem(id: number, userId?: number) {
    const item = await this.prisma.priceItem.findFirst({
      where: { id, ...this.ownerFilter(userId) },
    });
    if (!item)
      throw new NotFoundException('Расценка не найдена или нет доступа');
    await this.assertCanEditShared(item.ownerId, userId);
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
