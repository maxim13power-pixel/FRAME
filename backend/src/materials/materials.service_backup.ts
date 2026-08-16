import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Unit } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateMaterialDto } from './dto/create-material.dto';
import { CreateFixDto } from './dto/create-fix.dto';

@Injectable()
export class MaterialsService {
  constructor(private prisma: PrismaService) {}

  // Все материалы проекта
  async findAllByProject(projectId: number) {
    return this.prisma.material.findMany({
      where: { projectId },
      orderBy: { id: 'asc' },
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

  // Создание материала
  async create(dto: CreateMaterialDto) {
    const project = await this.prisma.project.findUnique({ where: { id: dto.projectId } });
    if (!project) throw new NotFoundException('Проект не найден');

    return this.prisma.material.create({
      data: {
        name: dto.name.trim(),
        article: dto.article?.trim() || null,
        unit: (dto.unit ?? 'PIECE') as Unit,
        specQuantity: dto.specQuantity,
        note: dto.note ?? null,
        projectId: dto.projectId,
      },
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
        },
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
    });
  }

  // 🔒 Переключение защиты спецификации
  async toggleSpecLock(id: number) {
    const material = await this.prisma.material.findUnique({ where: { id } });
    if (!material) throw new NotFoundException('Материал не найден');

    return this.prisma.material.update({
      where: { id },
      data: { isSpecLocked: !material.isSpecLocked },
    });
  }

  // Удаление (фиксации удалятся каскадно)
  async remove(id: number) {
    const material = await this.prisma.material.findUnique({ where: { id } });
    if (!material) throw new NotFoundException('Материал не найден');
    return this.prisma.material.delete({ where: { id } });
  }
}