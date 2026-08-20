import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Unit } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateMaterialDto } from './dto/create-material.dto';
import { CreateFixDto } from './dto/create-fix.dto';
import { CreateCategoryDto } from '../price-list/dto/create-category.dto';
import { CreatePriceItemDto } from '../price-list/dto/create-price-item.dto';
import { UpdateMaterialDto } from './dto/update-material.dto';
@Injectable()
export class MaterialsService {
  constructor(private prisma: PrismaService) {}

  // Все материалы проекта (с расценкой и её категорией из справочника)
  async findAllByProject(projectId: number) {
    return this.prisma.material.findMany({
      where: { projectId },
      orderBy: { id: 'asc' },
      include: { priceItem: { include: { category: true } } },
    });
  }

  // История фиксаций одного материала (для отчёта по дням)
  async findFixes(materialId: number) {
    const material = await this.prisma.material.findUnique({ where: { id: materialId } });
    if (!material) throw new NotFoundException('Материал не найден');
    return this.prisma.materialFix.findMany({
      where: { materialId },
      orderBy: { fixedAt: 'desc' },
    });
  }

  // Создание материала (+ snapshot цены из справочника)
  async create(dto: CreateMaterialDto) {
    const project = await this.prisma.project.findUnique({ where: { id: dto.projectId } });
    if (!project) throw new NotFoundException('Проект не найден');

    // ⭐ Если выбрана расценка — снимаем snapshot её цены
    let unitPrice = 0;
    if (dto.priceItemId) {
      const priceItem = await this.prisma.priceItem.findUnique({
        where: { id: dto.priceItemId },
      });
      if (!priceItem) throw new NotFoundException('Расценка не найдена');
      if (!priceItem.isActive) {
        throw new BadRequestException('Выбранная расценка неактивна');
      }
      unitPrice = priceItem.price;
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
      },
      include: { priceItem: { include: { category: true } } },
    });
  }

  // ⭐ ГЛАВНАЯ ФИЧА из старого кода: фиксация объёма
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

    // Транзакция: запись фиксации + пересчёт агрегатов атомарно
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
          totalCost: newTotal * material.unitPrice, // ⭐ пересчёт стоимости
        },
        include: { priceItem: { include: { category: true } } },
      });
    });
  }

  // Обновление количества по спецификации + пересчёт процента
  async updateSpecQty(id: number, specQuantity: number) {
    const material = await this.prisma.material.findUnique({ where: { id } });
    if (!material) throw new NotFoundException('Материал не найден');
    const progress = specQuantity > 0
      ? Math.round((material.totalUsed / specQuantity) * 100)
      : 0;
    return this.prisma.material.update({
      where: { id },
      data: { specQuantity, progressPercent: progress },
      include: { priceItem: { include: { category: true } } },
    });
  }

  // 🔒 Переключение защиты спецификации
  async toggleSpecLock(id: number) {
    const material = await this.prisma.material.findUnique({ where: { id } });
    if (!material) throw new NotFoundException('Материал не найден');
    return this.prisma.material.update({
      where: { id },
      data: { isSpecLocked: !material.isSpecLocked },
      include: { priceItem: { include: { category: true } } },
    });
  }
  // ✏️ Исправление последней фиксации (защита от ошибок ввода)
  async editLastFix(id: number, dto: CreateFixDto) {
    const material = await this.prisma.material.findUnique({ where: { id } });
    if (!material) throw new NotFoundException('Материал не найден');

    const lastFix = await this.prisma.materialFix.findFirst({
      where: { materialId: id },
      orderBy: { fixedAt: 'desc' },
    });
    if (!lastFix) throw new BadRequestException('У материала ещё нет фиксаций');

    // Защита: исправляем свежие фиксации (72 часа — пятница→понедельник)
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
        },
        include: { priceItem: { include: { category: true } } },
      });
    });
  }
  // ✏️ Полное редактирование материала (смена расценки + защита данных)
  async update(id: number, dto: UpdateMaterialDto) {
    const material = await this.prisma.material.findUnique({ where: { id } });
    if (!material) throw new NotFoundException('Материал не найден');

    // Если меняется priceItemId — подтягиваем snapshot новой цены
    let unitPrice = material.unitPrice;
    let priceItemId: number | null = material.priceItemId;

    if (dto.priceItemId !== undefined && dto.priceItemId !== material.priceItemId) {
      if (dto.priceItemId === null) {
        // Сброс привязки
        unitPrice = 0;
        priceItemId = null;
      } else {
        const priceItem = await this.prisma.priceItem.findUnique({
          where: { id: dto.priceItemId },
        });
        if (!priceItem) throw new NotFoundException('Расценка не найдена');
        if (!priceItem.isActive) throw new BadRequestException('Расценка неактивна');
        unitPrice = priceItem.price;
        priceItemId = priceItem.id;
      }
    }

    // Пересчёт progressPercent при смене спеки
    const newSpecQty = dto.specQuantity ?? material.specQuantity;
    const progress = newSpecQty > 0
      ? Math.round((material.totalUsed / newSpecQty) * 100)
      : 0;
    const totalCost = material.totalUsed * unitPrice;

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
        totalCost,
      },
      include: { priceItem: { include: { category: true } } },
    });
  }

  // ✨ Удобная обёртка: создать категорию (если надо) + расценку в одном запросе
  async createPriceItemWithCategory(
    itemDto: CreatePriceItemDto,
    newCategoryName?: string,
  ) {
    let categoryId = itemDto.categoryId;

    // Если передано имя новой категории — создаём её
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