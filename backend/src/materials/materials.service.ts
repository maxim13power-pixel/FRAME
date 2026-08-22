import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Unit } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateMaterialDto } from './dto/create-material.dto';
import { CreateFixDto } from './dto/create-fix.dto';
import { UpdateMaterialDto } from './dto/update-material.dto';
import { CreatePriceItemDto } from '../price-list/dto/create-price-item.dto';

// ⭐ Общий include: расценка работы + расценка материала (с категориями)
const MATERIAL_INCLUDE = {
  priceItem: { include: { category: true } },
  materialItem: { include: { category: true } },
};

@Injectable()
export class MaterialsService {
  constructor(private prisma: PrismaService) {}

  // Все материалы проекта (с обеими расценками)
  async findAllByProject(projectId: number) {
    return this.prisma.material.findMany({
      where: { projectId },
      orderBy: { id: 'asc' },
      include: MATERIAL_INCLUDE,
    });
  }

  // История фиксаций одного материала
  async findFixes(materialId: number) {
    const material = await this.prisma.material.findUnique({ where: { id: materialId } });
    if (!material) throw new NotFoundException('Материал не найден');
    return this.prisma.materialFix.findMany({
      where: { materialId },
      orderBy: { fixedAt: 'desc' },
    });
  }

  // Создание материала (+ snapshot цен работы и материала)
  async create(dto: CreateMaterialDto) {
    const project = await this.prisma.project.findUnique({ where: { id: dto.projectId } });
    if (!project) throw new NotFoundException('Проект не найден');

    let unitPrice = 0;
    if (dto.priceItemId) {
      const priceItem = await this.prisma.priceItem.findUnique({ where: { id: dto.priceItemId } });
      if (!priceItem) throw new NotFoundException('Расценка не найдена');
      if (!priceItem.isActive) throw new BadRequestException('Выбранная расценка неактивна');
      unitPrice = priceItem.price;
    }

    let materialUnitPrice = 0;
    if (dto.materialItemId) {
      const materialItem = await this.prisma.priceItem.findUnique({ where: { id: dto.materialItemId } });
      if (!materialItem) throw new NotFoundException('Расценка материала не найдена');
      if (!materialItem.isActive) throw new BadRequestException('Расценка материала неактивна');
      materialUnitPrice = materialItem.price;
    }

    return this.prisma.material.create({
      data: {
        name: dto.name.trim(),
        article: dto.article?.trim() || null,
        unit: (dto.unit ?? 'PIECE') as Unit,
        specQuantity: dto.specQuantity,
        note: dto.note ?? null,
        projectId: dto.projectId,
        priceItemId: dto.priceItemId ?? null,
        unitPrice,
        totalCost: 0,
        materialItemId: dto.materialItemId ?? null,
        materialUnitPrice,
        materialTotalCost: 0,
      },
      include: MATERIAL_INCLUDE,
    });
  }

  // ⭐ Фиксация объёма + пересчёт ОБЕИХ стоимостей
  async addFix(materialId: number, dto: CreateFixDto) {
    const material = await this.prisma.material.findUnique({ where: { id: materialId } });
    if (!material) throw new NotFoundException('Материал не найден');
    if (!dto.amount || dto.amount <= 0) {
      throw new BadRequestException('Объём фиксации должен быть больше нуля');
    }
    const newTotal = material.totalUsed + dto.amount;
    const progress = material.specQuantity > 0
      ? Math.round((newTotal / material.specQuantity) * 100)
      : 0;

    return this.prisma.$transaction(async (tx) => {
      await tx.materialFix.create({
        data: {
          materialId,
          amount: dto.amount,
          note: dto.note ?? null,
        },
      });
      return tx.material.update({
        where: { id: materialId },
        data: {
          totalUsed: newTotal,
          lastEntry: dto.amount,
          lastEntryDate: new Date(),
          progressPercent: progress,
          totalCost: newTotal * material.unitPrice,
          materialTotalCost: newTotal * material.materialUnitPrice,
        },
        include: MATERIAL_INCLUDE,
      });
    });
  }

  // Обновление спеки + пересчёт процента
  async updateSpecQty(id: number, specQuantity: number) {
    const material = await this.prisma.material.findUnique({ where: { id } });
    if (!material) throw new NotFoundException('Материал не найден');
    const progress = specQuantity > 0
      ? Math.round((material.totalUsed / specQuantity) * 100)
      : 0;
    return this.prisma.material.update({
      where: { id },
      data: { specQuantity, progressPercent: progress },
      include: MATERIAL_INCLUDE,
    });
  }

  // 🔒 Переключение защиты спецификации
  async toggleSpecLock(id: number) {
    const material = await this.prisma.material.findUnique({ where: { id } });
    if (!material) throw new NotFoundException('Материал не найден');
    return this.prisma.material.update({
      where: { id },
      data: { isSpecLocked: !material.isSpecLocked },
      include: MATERIAL_INCLUDE,
    });
  }

  // ✏️ Исправление последней фиксации (72 часа)
  async editLastFix(id: number, dto: CreateFixDto) {
    const material = await this.prisma.material.findUnique({ where: { id } });
    if (!material) throw new NotFoundException('Материал не найден');

    const lastFix = await this.prisma.materialFix.findFirst({
      where: { materialId: id },
      orderBy: { fixedAt: 'desc' },
    });
    if (!lastFix) throw new BadRequestException('У материала ещё нет фиксаций');

    const ageMs = Date.now() - lastFix.fixedAt.getTime();
    if (ageMs > 72 * 60 * 60 * 1000) {
      throw new BadRequestException('Исправить можно только фиксацию младше 72 часов');
    }
    if (!dto.amount || dto.amount <= 0) {
      throw new BadRequestException('Объём должен быть больше нуля');
    }

    const newTotal = material.totalUsed - lastFix.amount + dto.amount;
    const progress = material.specQuantity > 0
      ? Math.round((newTotal / material.specQuantity) * 100)
      : 0;

    return this.prisma.$transaction(async (tx) => {
      await tx.materialFix.update({
        where: { id: lastFix.id },
        data: { amount: dto.amount, note: dto.note ?? null },
      });
      return tx.material.update({
        where: { id },
        data: {
          totalUsed: newTotal,
          lastEntry: dto.amount,
          progressPercent: progress,
          totalCost: newTotal * material.unitPrice,
          materialTotalCost: newTotal * material.materialUnitPrice,
        },
        include: MATERIAL_INCLUDE,
      });
    });
  }

  // ✏️ Полное редактирование (смена расценок работы и материала)
  async update(id: number, dto: UpdateMaterialDto) {
    const material = await this.prisma.material.findUnique({ where: { id } });
    if (!material) throw new NotFoundException('Материал не найден');

    // Смена расценки РАБОТЫ
    let unitPrice = material.unitPrice;
    let priceItemId: number | null = material.priceItemId;
    if (dto.priceItemId !== undefined && dto.priceItemId !== material.priceItemId) {
      if (dto.priceItemId === null) {
        unitPrice = 0;
        priceItemId = null;
      } else {
        const priceItem = await this.prisma.priceItem.findUnique({ where: { id: dto.priceItemId } });
        if (!priceItem) throw new NotFoundException('Расценка не найдена');
        if (!priceItem.isActive) throw new BadRequestException('Расценка неактивна');
        unitPrice = priceItem.price;
        priceItemId = priceItem.id;
      }
    }

    // ⭐ Смена расценки МАТЕРИАЛА
    let materialUnitPrice = material.materialUnitPrice;
    let materialItemId: number | null = material.materialItemId;
    if (dto.materialItemId !== undefined && dto.materialItemId !== material.materialItemId) {
      if (dto.materialItemId === null) {
        materialUnitPrice = 0;
        materialItemId = null;
      } else {
        const materialItem = await this.prisma.priceItem.findUnique({ where: { id: dto.materialItemId } });
        if (!materialItem) throw new NotFoundException('Расценка материала не найдена');
        if (!materialItem.isActive) throw new BadRequestException('Расценка материала неактивна');
        materialUnitPrice = materialItem.price;
        materialItemId = materialItem.id;
      }
    }

    const newSpecQty = dto.specQuantity ?? material.specQuantity;
    const progress = newSpecQty > 0
      ? Math.round((material.totalUsed / newSpecQty) * 100)
      : 0;

    return this.prisma.material.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        article: dto.article !== undefined ? dto.article.trim() || null : undefined,
        unit: dto.unit ? (dto.unit as Unit) : undefined,
        note: dto.note !== undefined ? dto.note.trim() || null : undefined,
        specQuantity: dto.specQuantity,
        progressPercent: progress,
        priceItemId,
        unitPrice,
        totalCost: material.totalUsed * unitPrice,
        materialItemId,
        materialUnitPrice,
        materialTotalCost: material.totalUsed * materialUnitPrice,
      },
      include: MATERIAL_INCLUDE,
    });
  }

  // ✨ Создать расценку (+ опционально новую категорию) в одном запросе
  async createPriceItemWithCategory(
    itemDto: CreatePriceItemDto,
    newCategoryName?: string,
  ) {
    let categoryId = itemDto.categoryId;

    if (newCategoryName && newCategoryName.trim()) {
      const created = await this.prisma.priceCategory.create({
        data: { name: newCategoryName.trim(), sortOrder: 0 },
      });
      categoryId = created.id;
    }

    const category = await this.prisma.priceCategory.findUnique({
      where: { id: categoryId },
    });
    if (!category) throw new NotFoundException('Категория не найдена');

    return this.prisma.priceItem.create({
      data: {
        name: itemDto.name.trim(),
        article: itemDto.article?.trim() || null,
        unit: (itemDto.unit ?? 'PIECE') as Unit,
        price: itemDto.price,
        categoryId,
      },
      include: { category: true },
    });
  }

  // Удаление (фиксации удалятся каскадно)
  async remove(id: number) {
    const material = await this.prisma.material.findUnique({ where: { id } });
    if (!material) throw new NotFoundException('Материал не найден');
    return this.prisma.material.delete({ where: { id } });
  }
}