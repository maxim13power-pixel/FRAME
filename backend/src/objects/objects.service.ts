// backend/src/objects/objects.service.ts
import { ForbiddenException, Injectable } from '@nestjs/common';
import { AccessRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateObjectDto } from './dto/create-object.dto';
import {
  accessibleObjectWhere,
  accessibleProjectWhere,
  buildAccessScope,
  loadAccessGrants,
  resolveObjectRole,
} from '../auth/access-scope'; // ⭐ №163

@Injectable()
export class ObjectsService {
  constructor(private prisma: PrismaService) {}

  // ⭐ Хелпер: проверяет доступ юзера к объекту. Кидает 403 если доступа нет.
  // Возвращает запись доступа (там роль — пригодится для проверок прав).
  // Детерминированный резолв: объектный контекст требует общую запись (projectId: null).
  private async checkAccess(objectId: number, userId: number) {
    const access = await this.prisma.objectAccess.findFirst({
      where: { userId, objectId, projectId: null },
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

  // Все объекты, к которым у юзера есть доступ (включая архивные — фронт сам фильтрует).
  // ⭐ №163: участник, приглашённый только в проект, видит объект, но лишь свой проект.
  async findAll(userId: number) {
    const grants = await loadAccessGrants(this.prisma, userId);
    const scope = buildAccessScope(grants);

    const objects = await this.prisma.object.findMany({
      where: accessibleObjectWhere(scope, { includeArchived: true }),
      orderBy: { createdAt: 'desc' },
      include: {
        projects: {
          where: accessibleProjectWhere(scope, { includeArchived: true }),
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

    // Честный % из материалов доступных проектов
    return objects.map((o) => {
      let sumSpec = 0;
      let sumUsed = 0;
      let sumCost = 0;
      o.projects.forEach((p) =>
        p.materials.forEach((m) => {
          // 🔒 P1-3: поля Decimal — приводим к number, иначе += склеивает строки
          sumSpec += Number(m.specQuantity || 0);
          sumUsed += Number(m.totalUsed || 0);
          sumCost += Number(m.totalCost || 0) + Number(m.materialTotalCost || 0);
        }),
      );
      const { projects, ...rest } = o;
      const my = resolveObjectRole(grants, o.id);
      return {
        ...rest,
        projectsCount: projects.length, // ⭐ №163: проектов, доступных юзеру
        progressPercent:
          sumSpec > 0 ? Math.round((sumUsed / sumSpec) * 100) : 0,
        // ⭐ Деньги прячем, объёмы/прогресс оставляем
        totalCost: my.hidePrices ? 0 : sumCost,
        // ⭐ Роль и флаги юзера на объекте — фронту для UI-правил
        role: my.role ?? undefined,
        hidePrices: my.hidePrices,
        hasObjectAccess: my.hasObjectAccess, // ⭐ №163: можно ли править сам объект
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

  // Удаление → АРХИВАЦИЯ (ТЗ 3.8: архив вместо жёсткого удаления).
  // ⭐ permanent=true — жёсткое удаление (для демо-объекта, который не жалко).
  async remove(id: number, userId: number, permanent = false) {
    await this.checkAccess(id, userId);
    if (permanent) {
      return this.prisma.object.delete({ where: { id } });
    }
    return this.prisma.object.update({
      where: { id },
      data: { isArchived: true },
    });
  }

  // ⭐ Восстановить объект из архива
  async restore(id: number, userId: number) {
    await this.checkAccess(id, userId);
    return this.prisma.object.update({
      where: { id },
      data: { isArchived: false },
    });
  }

  async findOne(id: number, userId: number) {
    // ⭐ №163: объект доступен и участнику отдельного проекта (нужен для шапки сметы)
    const grants = await loadAccessGrants(this.prisma, userId);
    const my = resolveObjectRole(grants, id);
    if (!my.role) {
      throw new ForbiddenException('Нет доступа к этому объекту');
    }
    const object = await this.prisma.object.findUnique({ where: { id } });
    if (!object) return null;
    // ⭐ Возвращаем роль и флаг юзера (фронт использует для UI-правил)
    return {
      ...object,
      role: my.role,
      hidePrices: my.hidePrices,
      hasObjectAccess: my.hasObjectAccess, // ⭐ №163: права на сам объект
    };
  }

  async updateEndDate(id: number, newEndDate: string, userId: number) {
    await this.checkAccess(id, userId);
    return this.prisma.object.update({
      where: { id },
      data: { endDate: new Date(newEndDate) },
    });
  }
}
