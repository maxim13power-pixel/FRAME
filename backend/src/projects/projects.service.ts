import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { BadRequestException } from '@nestjs/common';
@Injectable()
export class ProjectsService {
  constructor(private prisma: PrismaService) {}

async create(dto: CreateProjectDto) {
  // Дополнительная проверка дат на уровне сервиса
  const startDate = new Date(dto.startDate);
  const endDate = new Date(dto.endDate);

  if (isNaN(startDate.getTime())) {
    throw new BadRequestException('Невалидная дата начала');
  }
  if (isNaN(endDate.getTime())) {
    throw new BadRequestException('Невалидная дата окончания');
  }
  if (endDate < startDate) {
    throw new BadRequestException('Дата окончания не может быть раньше даты начала');
  }

  return this.prisma.project.create({
    data: {
      name: dto.name.trim(),
      startDate,
      endDate,
      objectId: dto.objectId,
      note: dto.note || null,
    },
  });
}

  async findAllByObject(objectId: number) {
    const projects = await this.prisma.project.findMany({
      where: { objectId },
      orderBy: { createdAt: 'desc' },
      include: {
        materials: { select: { specQuantity: true, totalUsed: true, totalCost: true } },
      },
    });
    // ⭐ Честный процент: Σ Итого / Σ По спец × 100 по материалам проекта
    return projects.map(p => {
      const sumSpec = p.materials.reduce((a, m) => a + (m.specQuantity || 0), 0);
      const sumUsed = p.materials.reduce((a, m) => a + (m.totalUsed || 0), 0);
      const sumCost = p.materials.reduce((a, m) => a + (m.totalCost || 0), 0);
      const { materials, ...rest } = p;
      return {
        ...rest,
        progressPercent: sumSpec > 0 ? Math.round((sumUsed / sumSpec) * 100) : 0,
        totalCost: sumCost,
      };
    });
  }

  async findOne(id: number) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: {
        materials: { select: { specQuantity: true, totalUsed: true, totalCost: true } },
      },
    });
    if (!project) return null;
    const sumSpec = project.materials.reduce((a, m) => a + (m.specQuantity || 0), 0);
    const sumUsed = project.materials.reduce((a, m) => a + (m.totalUsed || 0), 0);
    const sumCost = project.materials.reduce((a, m) => a + (m.totalCost || 0), 0);
    const { materials, ...rest } = project;
    return {
      ...rest,
      progressPercent: sumSpec > 0 ? Math.round((sumUsed / sumSpec) * 100) : 0,
      totalCost: sumCost,
    };
  }

  async update(id: number, dto: Partial<CreateProjectDto>) {
    await this.prisma.project.update({
      where: { id },
      data: {
        name: dto.name,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        note: dto.note !== undefined ? dto.note : undefined,
      },
    });
    // ⭐ Возвращаем проект с честным процентом (та же форма, что в списке)
    return this.findOne(id);
  }

  async remove(id: number) {
    return this.prisma.project.delete({ where: { id } });
  }
}