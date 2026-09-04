// backend/src/projects/projects.service.ts
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AccessRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateProjectDto } from './dto/create-project.dto';

@Injectable()
export class ProjectsService {
  constructor(private prisma: PrismaService) {}

  // ⭐ Хелпер: проверяет доступ к объекту. Кидает 403 если доступа нет.
  private async checkObjectAccess(objectId: number, userId: number) {
    const access = await this.prisma.objectAccess.findFirst({
      where: { userId, objectId },
    });
    if (!access) {
      throw new ForbiddenException('Нет доступа к этому объекту');
    }
    return access;
  }

  // ⭐ Хелпер: проверяет доступ к объекту ЧЕРЕЗ проект (находит objectId проекта)
  private async checkProjectAccess(projectId: number, userId: number) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { objectId: true },
    });
    if (!project) {
      throw new NotFoundException('Проект не найден');
    }
    return this.checkObjectAccess(project.objectId, userId);
  }

  // ⭐ Нужно ли скрывать цены для этой записи доступа
  private mustHidePrices(access?: { role?: string; hidePrices?: boolean } | null): boolean {
    if (!access) return false;
    if (access.role === 'VIEWER') return true;
    return access.hidePrices ?? false;
  }

  async create(dto: CreateProjectDto, userId: number) {
    // Валидация дат на уровне сервиса
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

    // ⭐ Проверяем доступ к объекту (вместо старой проверки по организации)
    const access = await this.checkObjectAccess(dto.objectId, userId);
    // Наблюдатель не может создавать проекты
    if (access.role === AccessRole.VIEWER) {
      throw new ForbiddenException('Наблюдатель не может создавать проекты');
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

  async findAllByObject(objectId: number, userId: number) {
    // ⭐ Проверяем доступ к объекту (заодно получаем запись доступа)
    const access = await this.checkObjectAccess(objectId, userId);
    const hidePrices = this.mustHidePrices(access);

    const projects = await this.prisma.project.findMany({
      where: { objectId },
      orderBy: { createdAt: 'desc' },
      include: {
        materials: { select: { specQuantity: true, totalUsed: true, totalCost: true } },
      },
    });

    // ⭐ Честный процент: Σ Итого / Σ По спец × 100 по материалам проекта
    return projects.map((p) => {
      const sumSpec = p.materials.reduce((a, m) => a + (m.specQuantity || 0), 0);
      const sumUsed = p.materials.reduce((a, m) => a + (m.totalUsed || 0), 0);
      const sumCost = p.materials.reduce((a, m) => a + (m.totalCost || 0), 0);
      const { materials, ...rest } = p;
      return {
        ...rest,
        progressPercent: sumSpec > 0 ? Math.round((sumUsed / sumSpec) * 100) : 0,
        // ⭐ Скрываем стоимость, если у юзера скрыты цены
        totalCost: hidePrices ? 0 : sumCost,
      };
    });
  }

  async findOne(id: number, userId?: number) {
    // Если пришёл userId — проверяем доступ (запоминаем access для скрытия цен)
    let access: any = null;
    if (userId) {
      access = await this.checkProjectAccess(id, userId);
    }
    const hidePrices = this.mustHidePrices(access);
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
      // ⭐ Скрываем стоимость, если у юзера скрыты цены
      totalCost: hidePrices ? 0 : sumCost,
    };
  }

  async update(id: number, dto: Partial<CreateProjectDto>, userId?: number) {
    if (userId) {
      const access = await this.checkProjectAccess(id, userId);
      if (access.role === AccessRole.VIEWER) {
        throw new ForbiddenException('Наблюдатель не может редактировать проекты');
      }
    }
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
    return this.findOne(id, userId);
  }

  async remove(id: number, userId?: number) {
    if (userId) {
      const access = await this.checkProjectAccess(id, userId);
      if (access.role === AccessRole.VIEWER) {
        throw new ForbiddenException('Наблюдатель не может удалять проекты');
      }
    }
    return this.prisma.project.delete({ where: { id } });
  }
}