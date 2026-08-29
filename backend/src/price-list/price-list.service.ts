// backend/src/price-list/price-list.service.ts
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PriceKind, Unit } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { CreatePriceItemDto } from './dto/create-price-item.dto';

@Injectable()
export class PriceListService {
  constructor(private prisma: PrismaService) {}

  // ⭐ Хелпер: фильтр расценок — ОБЩИЕ (ownerId=null) + ЛИЧНЫЕ текущего юзера.
  // Общий стартовый справочник виден всем; личный — только владельцу (ТЗ 3.7).
  private ownerFilter(userId?: number) {
    return userId
      ? { OR: [{ ownerId: null }, { ownerId: userId }] }
      : { ownerId: null };
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
  async getCategoriesWithItems(kind?: string, userId?: number) {
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
            ...this.ownerFilter(userId),
          },
          orderBy: { name: 'asc' },
        },
      },
    });
  }

  // Поиск расценок (для Autocomplete в материалах): общие + личные юзера.
  // ⭐ Через явный AND, чтобы OR владельца и OR поиска не затёрли друг друга.
  async searchItems(search?: string, categoryId?: number, kind?: string, userId?: number) {
    return this.prisma.priceItem.findMany({
      where: {
        AND: [
          { isActive: true },
          ...(kind ? [{ kind: kind as PriceKind }] : []),
          ...(categoryId ? [{ categoryId }] : []),
          this.ownerFilter(userId),
          ...(search
            ? [
                {
                  OR: [
                    { name: { contains: search, mode: 'insensitive' as const } },
                    { article: { contains: search, mode: 'insensitive' as const } },
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

  // Создание расценки → в ЛИЧНЫЙ справочник юзера (ТЗ 3.7)
  async createItem(dto: CreatePriceItemDto, userId?: number) {
    // Проверяем что категория существует (категории общие)
    const category = await this.prisma.priceCategory.findFirst({
      where: { id: dto.categoryId },
    });
    if (!category) throw new NotFoundException('Категория не найдена');

    return this.prisma.priceItem.create({
      data: {
        name: dto.name.trim(),
        article: dto.article?.trim() || null,
        unit: (dto.unit ?? 'PIECE') as Unit,
        price: dto.price,
        categoryId: dto.categoryId,
        kind: (dto.kind as PriceKind) ?? 'WORK',
        ownerId: userId ?? null, // ⭐ личная расценка (ТЗ 3.7)
      },
    });
  }

  // Обновление расценки: можно менять ОБЩИЕ и СВОИ расценки
  async updateItem(id: number, dto: Partial<CreatePriceItemDto>, userId?: number) {
    const item = await this.prisma.priceItem.findFirst({
      where: { id, ...this.ownerFilter(userId) },
    });
    if (!item) throw new NotFoundException('Расценка не найдена или нет доступа');
    return this.prisma.priceItem.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name?.trim() }),
        ...(dto.article !== undefined && { article: dto.article?.trim() || null }),
        ...(dto.unit != null && { unit: dto.unit as Unit }),
        ...(dto.price !== undefined && { price: dto.price }),
      },
    });
  }

  // Не удаляем, а деактивируем — старые сметы остаются нетронутыми.
  // Можно деактивировать ОБЩИЕ и СВОИ расценки.
  async removeItem(id: number, userId?: number) {
    const item = await this.prisma.priceItem.findFirst({
      where: { id, ...this.ownerFilter(userId) },
    });
    if (!item) throw new NotFoundException('Расценка не найдена или нет доступа');
    return this.prisma.priceItem.update({
      where: { id },
      data: { isActive: false },
    });
  }
}