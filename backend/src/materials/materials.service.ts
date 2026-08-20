import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Unit } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateMaterialDto } from './dto/create-material.dto';
import { CreateFixDto } from './dto/create-fix.dto';

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

  // Удаление (фиксации удалятся каскадно)
  async remove(id: number) {
    const material = await this.prisma.material.findUnique({ where: { id } });
    if (!material) throw new NotFoundException('Материал не найден');
    return this.prisma.material.delete({ where: { id } });
  }
}