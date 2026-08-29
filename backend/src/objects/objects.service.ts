// backend/src/objects/objects.service.ts
import { ForbiddenException, Injectable } from '@nestjs/common';
import { AccessRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateObjectDto } from './dto/create-object.dto';

@Injectable()
export class ObjectsService {
  constructor(private prisma: PrismaService) {}

  // ⭐ Хелпер: проверяет доступ юзера к объекту. Кидает 403 если доступа нет.
  // Возвращает запись доступа (там роль — пригодится для проверок прав).
  private async checkAccess(objectId: number, userId: number) {
    const access = await this.prisma.objectAccess.findFirst({
      where: { userId, objectId },
    });
    if (!access) {
      throw new ForbiddenException('Нет доступа к этому объекту');
    }
    return access;
  }

  // Создание объекта.
  // Создатель автоматически получает доступ с ролью из dto (дефолт — заказчик).
  async create(dto: CreateObjectDto, userId: number) {
    // Роль создателя: из DTO (модалка «В какой роли создаёшь?») или по умолчанию заказчик.
    // Через (dto as any) — чтобы не ломаться, если поле ещё не добавлено в DTO.
    const createRole: AccessRole =
      ((dto as any).role as AccessRole) || AccessRole.CUSTOMER;

    return this.prisma.object.create({
      data: {
        name: dto.name,
        address: dto.address,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        plannedEndDate: dto.plannedEndDate
          ? new Date(dto.plannedEndDate)
          : new Date(dto.endDate),
        note: dto.note || null,
        isArchived: false,
        // ⭐ Сразу создаём доступ для создателя (вложенный create)
        accesses: {
          create: {
            userId,
            role: createRole,
          },
        },
      },
    });
  }

  // Все объекты, к которым у юзера есть доступ (включая архивные — фронт сам фильтрует)
  async findAll(userId: number) {
    const objects = await this.prisma.object.findMany({
      where: {
        accesses: { some: { userId } }, // ⭐ фильтр по таблице доступа
      },
      orderBy: { createdAt: 'desc' },
      include: {
        projects: {
          include: {
            materials: {
              select: {
                specQuantity: true,
                totalUsed: true,
                totalCost: true,
                materialTotalCost: true,
              },
            },
          },
        },
      },
    });

    // Честный % из материалов всех проектов
    return objects.map((o) => {
      let sumSpec = 0;
      let sumUsed = 0;
      let sumCost = 0;
      o.projects.forEach((p) =>
        p.materials.forEach((m) => {
          sumSpec += m.specQuantity || 0;
          sumUsed += m.totalUsed || 0;
          sumCost += (m.totalCost || 0) + (m.materialTotalCost || 0);
        }),
      );
      const { projects, ...rest } = o;
      return {
        ...rest,
        progressPercent: sumSpec > 0 ? Math.round((sumUsed / sumSpec) * 100) : 0,
        totalCost: sumCost,
      };
    });
  }

  // Обновление — только если есть доступ к объекту
  async update(id: number, dto: Partial<CreateObjectDto>, userId: number) {
    await this.checkAccess(id, userId);
    return this.prisma.object.update({
      where: { id },
      data: {
        name: dto.name,
        address: dto.address,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        note: dto.note !== undefined ? dto.note : undefined,
      },
    });
  }

  // Удаление → АРХИВАЦИЯ (ТЗ 3.8: архив вместо жёсткого удаления)
  async remove(id: number, userId: number) {
    await this.checkAccess(id, userId);
    return this.prisma.object.update({
      where: { id },
      data: { isArchived: true },
    });
  }

  async findOne(id: number, userId: number) {
    await this.checkAccess(id, userId);
    return this.prisma.object.findUnique({ where: { id } });
  }

  async updateEndDate(id: number, newEndDate: string, userId: number) {
    await this.checkAccess(id, userId);
    return this.prisma.object.update({
      where: { id },
      data: { endDate: new Date(newEndDate) },
    });
  }
}