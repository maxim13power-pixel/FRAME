// backend/src/objects/objects.service.ts
import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
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

  // ⭐ №164: менять сам объект может только участник с объектным доступом
  // и не наблюдатель (раньше хватало любой записи projectId=null).
  private async assertCanEdit(objectId: number, userId: number) {
    const grants = await loadAccessGrants(this.prisma, userId);
    const my = resolveObjectRole(grants, objectId);
    if (!my.hasObjectAccess) {
      throw new ForbiddenException('Нет доступа к этому объекту');
    }
    if (my.role === AccessRole.VIEWER) {
      throw new ForbiddenException('Наблюдатель не может менять объект');
    }
  }

  // ⭐ №164: справочник, доступный пользователю (системный, свой, объектный/проектный)
  private async resolveCatalogId(catalogId: number, userId: number) {
    const catalog = await this.prisma.priceCatalog.findFirst({
      where: {
        id: catalogId,
        isArchived: false,
        OR: [
          { ownerId: null },
          { ownerId: userId },
          { objects: { some: { accesses: { some: { userId } } } } },
          { projects: { some: { object: { accesses: { some: { userId } } } } } },
        ],
      },
      select: { id: true },
    });
    if (!catalog) {
      throw new BadRequestException('Справочник цен не найден или в архиве');
    }
    return catalog.id;
  }

  // Создание объекта.
  // Создатель автоматически получает доступ с ролью из dto (дефолт — заказчик).
  async create(dto: CreateObjectDto, userId: number) {
    // Роль создателя: из DTO (модалка «В какой роли создаёшь?») или по умолчанию заказчик.
    // Через (dto as any) — чтобы не ломаться, если поле ещё не добавлено в DTO.
    const createRole: AccessRole =
      ((dto as any).role as AccessRole) || AccessRole.CUSTOMER;

    // ⭐ №164: справочник цен объекта (если передан) — проверяем доступ до создания
    const catalogId =
      dto.catalogId != null
        ? await this.resolveCatalogId(dto.catalogId, userId)
        : null;

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
        catalogId,
        // ⭐ Сразу создаём доступ для создателя (вложенный create)
        accesses: {
          create: {
            userId,
            role: createRole,
          },
        },
      },
      include: { catalog: { select: { id: true, name: true } } },
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
        // ⭐ №164: справочник цен объекта (наследуют проекты)
        catalog: { select: { id: true, name: true } },
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
    await this.assertCanEdit(id, userId);
    // ⭐ №164: смена справочника объекта (undefined = не трогаем, null = отвязать)
    const catalogId =
      dto.catalogId === undefined
        ? undefined
        : dto.catalogId === null
          ? null
          : await this.resolveCatalogId(dto.catalogId, userId);
    return this.prisma.object.update({
      where: { id },
      data: {
        name: dto.name,
        address: dto.address,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        note: dto.note !== undefined ? dto.note : undefined,
        catalogId,
      },
      include: { catalog: { select: { id: true, name: true } } },
    });
  }

  // Удаление → АРХИВАЦИЯ (ТЗ 3.8: архив вместо жёсткого удаления).
  // ⭐ permanent=true — жёсткое удаление (для демо-объекта, который не жалко).
  async remove(id: number, userId: number, permanent = false) {
    await this.assertCanEdit(id, userId);
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
    await this.assertCanEdit(id, userId);
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
    const object = await this.prisma.object.findUnique({
      where: { id },
      include: { catalog: { select: { id: true, name: true } } },
    });
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
    await this.assertCanEdit(id, userId);
    return this.prisma.object.update({
      where: { id },
      data: { endDate: new Date(newEndDate) },
    });
  }
}
