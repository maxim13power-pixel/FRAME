import { Injectable, NotFoundException } from '@nestjs/common';
import { Unit } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { CreatePriceItemDto } from './dto/create-price-item.dto';

@Injectable()
export class PriceListService {
  constructor(private prisma: PrismaService) {}

  // Все категории (для селектов)
  async getCategories() {
    return this.prisma.priceCategory.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  // Категории с активными расценками (для страницы справочника)
  async getCategoriesWithItems() {
    return this.prisma.priceCategory.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: {
        items: { where: { isActive: true }, orderBy: { name: 'asc' } },
      },
    });
  }

  // Поиск расценок (для Autocomplete в материалах)
  async searchItems(search?: string, categoryId?: number) {
    return this.prisma.priceItem.findMany({
      where: {
        isActive: true,
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
      data: { name: dto.name.trim(), sortOrder: dto.sortOrder ?? 0 },
    });
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
      },
    });
  }

  async updateItem(id: number, dto: Partial<CreatePriceItemDto>) {
    const item = await this.prisma.priceItem.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Расценка не найдена');

    return this.prisma.priceItem.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        article: dto.article?.trim() || null,
        unit: dto.unit ? (dto.unit as Unit) : undefined,
        price: dto.price,
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