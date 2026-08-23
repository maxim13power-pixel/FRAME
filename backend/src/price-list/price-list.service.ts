import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PriceKind, Unit } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { CreatePriceItemDto } from './dto/create-price-item.dto';

@Injectable()
export class PriceListService {
  constructor(private prisma: PrismaService) {}

  // Все категории (для селектов)
  async getCategories(kind?: string) {
    return this.prisma.priceCategory.findMany({
      where: kind ? { kind: kind as PriceKind } : {},
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  // Категории с активными расценками (для страницы справочника)
  async getCategoriesWithItems(kind?: string) {
    return this.prisma.priceCategory.findMany({
      where: kind ? { kind: kind as PriceKind } : {},
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: {
        items: {
          where: { isActive: true, ...(kind ? { kind: kind as PriceKind } : {}) },
          orderBy: { name: 'asc' },
        },
      },
    });
  }

  // Поиск расценок (для Autocomplete в материалах)
  async searchItems(search?: string, categoryId?: number, kind?: string) {
    return this.prisma.priceItem.findMany({
      where: {
        isActive: true,
        ...(kind ? { kind: kind as PriceKind } : {}),
        ...(categoryId ? { categoryId } : {}),
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { article: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: { category: true },
      orderBy: { name: 'asc' },
      take: 20,
    });
  }

  async createCategory(dto: CreateCategoryDto) {
    return this.prisma.priceCategory.create({
            data: {
        name: dto.name.trim(),
        sortOrder: dto.sortOrder ?? 0,
        kind: (dto.kind as PriceKind) ?? 'WORK',
      },
    });
  }

    // Переименование категории
  async updateCategory(id: number, dto: UpdateCategoryDto) {
    const category = await this.prisma.priceCategory.findUnique({ where: { id } });
    if (!category) throw new NotFoundException('Категория не найдена');
    return this.prisma.priceCategory.update({
      where: { id },
      data: { name: dto.name.trim() },
    });
  }

  // Удаление категории — ТОЛЬКО если в ней нет АКТИВНЫХ расценок
  // (иначе Cascade удалил бы расценки, а нам это не надо)
  async removeCategory(id: number) {
    const category = await this.prisma.priceCategory.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            items: { where: { isActive: true } }, // ⭐ считаем только активные
          },
        },
      },
    });
    if (!category) throw new NotFoundException('Категория не найдена');
    if (category._count.items > 0) {
      throw new BadRequestException(
        'Нельзя удалить категорию: в ней есть расценки. Сначала удалите или перенесите их.'
      );
    }
    return this.prisma.priceCategory.delete({ where: { id } });
  }
  
  async createItem(dto: CreatePriceItemDto) {
    const category = await this.prisma.priceCategory.findUnique({
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
      },
    });
  }

  async updateItem(id: number, dto: Partial<CreatePriceItemDto>) {
    const item = await this.prisma.priceItem.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Расценка не найдена');

    return this.prisma.priceItem.update({
      where: { id },
      data: {
        // PATCH-семантика: обновляем ТОЛЬКО поля, реально пришедшие в запросе.
        // Ключа нет (undefined) → spread ничего не добавляет → Prisma не трогает поле в БД.
        ...(dto.name !== undefined && { name: dto.name?.trim() }),
        ...(dto.article !== undefined && { article: dto.article?.trim() || null }),
        ...(dto.unit != null && { unit: dto.unit as Unit }),
        ...(dto.price !== undefined && { price: dto.price }),
      },
    });
  }

  // Не удаляем, а деактивируем — старые сметы остаются нетронутыми
  async removeItem(id: number) {
    const item = await this.prisma.priceItem.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Расценка не найдена');

    return this.prisma.priceItem.update({
      where: { id },
      data: { isActive: false },
    });
  }
}