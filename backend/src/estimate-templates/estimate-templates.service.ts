// backend/src/estimate-templates/estimate-templates.service.ts
// ⭐ №129: шаблоны смет — сохранить проект как шаблон и применить к другому проекту.
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEstimateTemplateDto } from './dto/create-estimate-template.dto';
import { ApplyEstimateTemplateDto } from './dto/apply-estimate-template.dto';

@Injectable()
export class EstimateTemplatesService {
  constructor(private prisma: PrismaService) {}

  // ⭐ Доступ к проекту (детерминированный резолв — как в materials.service.ts).
  private async checkProjectAccess(projectId: number, userId: number) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { objectId: true },
    });
    if (!project) {
      throw new NotFoundException('Проект не найден');
    }
    const access =
      (await this.prisma.objectAccess.findFirst({
        where: { userId, objectId: project.objectId, projectId },
      })) ??
      (await this.prisma.objectAccess.findFirst({
        where: { userId, objectId: project.objectId, projectId: null },
      }));
    if (!access) {
      throw new ForbiddenException('Нет доступа к этому проекту');
    }
    return access;
  }

  // Список СВОИХ шаблонов (с позициями).
  async list(userId: number) {
    return this.prisma.estimateTemplate.findMany({
      where: { ownerId: userId },
      orderBy: { createdAt: 'desc' },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    });
  }

  // Сохранить проект как шаблон — снимок материалов проекта.
  async create(dto: CreateEstimateTemplateDto, userId: number) {
    const name = dto.name.trim();
    if (!name) {
      throw new BadRequestException('Название шаблона обязательно');
    }
    await this.checkProjectAccess(dto.projectId, userId);

    const materials = await this.prisma.material.findMany({
      where: { projectId: dto.projectId },
      orderBy: { id: 'asc' },
      select: {
        name: true,
        unit: true,
        specQuantity: true,
        unitPrice: true,
        materialUnitPrice: true,
        priceItemId: true,
        materialItemId: true,
      },
    });

    return this.prisma.estimateTemplate.create({
      data: {
        name,
        ownerId: userId,
        items: {
          create: materials.map((m, idx) => ({
            name: m.name,
            unit: m.unit,
            quantity: m.specQuantity,
            unitPrice: m.unitPrice,
            materialUnitPrice: m.materialUnitPrice,
            priceItemId: m.priceItemId,
            materialItemId: m.materialItemId,
            sortOrder: idx,
          })),
        },
      },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    });
  }

  // Удалить СВОЙ шаблон (items удалятся каскадно).
  async remove(id: number, userId: number) {
    const template = await this.prisma.estimateTemplate.findFirst({
      where: { id, ownerId: userId },
      select: { id: true },
    });
    if (!template) {
      throw new NotFoundException('Шаблон не найден');
    }
    await this.prisma.estimateTemplate.delete({ where: { id } });
    return { success: true };
  }

  // Применить шаблон к проекту — создать материалы из позиций шаблона.
  async apply(id: number, dto: ApplyEstimateTemplateDto, userId: number) {
    const template = await this.prisma.estimateTemplate.findFirst({
      where: { id, ownerId: userId },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!template) {
      throw new NotFoundException('Шаблон не найден');
    }
    await this.checkProjectAccess(dto.projectId, userId);

    if (template.items.length === 0) {
      return { created: 0 };
    }

    await this.prisma.material.createMany({
      data: template.items.map((it) => ({
        name: it.name,
        unit: it.unit,
        specQuantity: it.quantity,
        priceItemId: it.priceItemId,
        unitPrice: it.unitPrice,
        materialItemId: it.materialItemId,
        materialUnitPrice: it.materialUnitPrice,
        projectId: dto.projectId,
        isSpecLocked: true, // защита спецификации (как у обычных материалов)
      })),
    });

    return { created: template.items.length };
  }
}
