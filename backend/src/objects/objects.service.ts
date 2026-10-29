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
  REVOKED_ACCESS_MESSAGE,
  resolveObjectRole,
} from '../auth/access-scope'; // ⭐ №163, №193

@Injectable()
export class ObjectsService {
  constructor(private prisma: PrismaService) {}

  // ⭐ №164: менять сам объект может только участник с объектным доступом
  // и не наблюдатель (раньше хватало любой записи projectId=null).
  // ⭐ №193 (A₂ F1): отозванный доступ не даёт живых данных вообще.
  private async assertCanEdit(objectId: number, userId: number) {
    const grants = await loadAccessGrants(this.prisma, userId);
    const my = resolveObjectRole(grants, objectId);
    if (!my.hasObjectAccess) {
      throw new ForbiddenException('Нет доступа к этому объекту');
    }
    if (my.revoked) {
      throw new ForbiddenException(REVOKED_ACCESS_MESSAGE);
    }
    if (!my.canWrite) {
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
  // ⭐ №181: создатель ВСЕГДА администратор объекта (решение владельца 27.10.2026).
  // Выбор роли при создании убран: прораб, создавший объект «как прораб», оставался без прав
  // на команду и настройки. Понизить себя / передать админку — через модалку участников.
  async create(dto: CreateObjectDto, userId: number) {
    // ⭐ №164: справочник цен объекта (если передан) — проверяем доступ до создания
    const catalogId =
      dto.catalogId != null
        ? await this.resolveCatalogId(dto.catalogId, userId)
        : null;

    // ⭐ №207: создатель сразу получает полные права на объект. Возвращаем те же флаги,
    // что и findOne, иначе самая свежая карточка в списке не знала бы, что можно
    // управлять командой (кнопка «Участники» оставалась бы неактивной до перезагрузки).
    const created = await this.prisma.object.create({
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
        createdById: userId, // ⭐ №168: метка автора (прав не даёт)
        // ⭐ Сразу создаём доступ для создателя (вложенный create)
        accesses: {
          create: {
            userId,
            role: AccessRole.CUSTOMER, // ⭐ №181: создатель — администратор объекта
            canCreateProjects: true, // ⭐ №207: админ объекта создаёт проекты
          },
        },
      },
      include: { catalog: { select: { id: true, name: true } } },
    });
    return {
      ...created,
      role: AccessRole.CUSTOMER,
      hidePrices: false,
      hasObjectAccess: true,
      canWrite: true,
      canManage: true,
      canCreateProjects: true,
      participantsCount: 1, // только создатель
      hiddenForMe: false,
      accessId: null,
    };
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

    // ⭐ №207: счётчик участников для кнопки «Участники» — считаем одним запросом
    // и только для объектов, где пользователь реально управляет командой.
    const manageableIds = objects
      .filter((o) => resolveObjectRole(grants, o.id).canManage)
      .map((o) => o.id);
    const participantRows = manageableIds.length
      ? await this.prisma.objectAccess.findMany({
          where: { objectId: { in: manageableIds }, revokedAt: null },
          select: { objectId: true, userId: true },
        })
      : [];
    const participantsByObject = new Map<number, Set<number>>();
    for (const row of participantRows) {
      const set = participantsByObject.get(row.objectId) ?? new Set<number>();
      set.add(row.userId);
      participantsByObject.set(row.objectId, set);
    }

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
        // ⭐ №168/№169: личный архив — на объект целиком (флаг живёт в записях доступа).
        // accessId берём объектную запись, а если её нет (доступ только на проект) —
        // любую свою запись, чтобы «в архив» работало и для проектного доступа.
        accessId:
          grants.find(
            (g) => g.objectId === o.id && g.projectId == null && !g.revokedAt,
          )?.id ??
          grants.find((g) => g.objectId === o.id && !g.revokedAt)?.id ??
          null,
        hiddenForMe: grants.some((g) => g.objectId === o.id && g.isHidden),
        canWrite: my.canWrite,
        canManage: my.canManage,
        // ⭐ №207: право создавать проекты + счётчик команды (только для админа объекта)
        canCreateProjects: my.canCreateProjects,
        participantsCount: my.canManage
          ? (participantsByObject.get(o.id)?.size ?? 0)
          : null,
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

  // ⚠️ №168: жёсткое удаление объектов запрещено. «Убрать с глаз» — это личный
  // архив пользователя (ObjectAccess.isHidden, PATCH /me/access/:id),
  // а не удаление данных: акты, склад и авторство остаются у остальных участников.

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
      // ⭐ №168/№169: личный архив / отзыв / управление командой
      accessId:
        grants.find(
          (g) => g.objectId === id && g.projectId == null && !g.revokedAt,
        )?.id ??
        grants.find((g) => g.objectId === id && !g.revokedAt)?.id ??
        null,
      hiddenForMe: grants.some((g) => g.objectId === id && g.isHidden),
      canWrite: my.canWrite,
      canManage: my.canManage,
      // ⭐ №207: право создавать проекты (для кнопки «Добавить проект» / заявки)
      canCreateProjects: my.canCreateProjects,
      participantsCount: my.canManage
        ? await this.countParticipants(id)
        : null,
    };
  }

  /** ⭐ №207: сколько людей в команде объекта (для подписи кнопки «Участники») */
  private async countParticipants(objectId: number) {
    const rows = await this.prisma.objectAccess.findMany({
      where: { objectId, revokedAt: null },
      select: { userId: true },
    });
    return new Set(rows.map((r) => r.userId)).size;
  }

  async updateEndDate(id: number, newEndDate: string, userId: number) {
    await this.assertCanEdit(id, userId);
    return this.prisma.object.update({
      where: { id },
      data: { endDate: new Date(newEndDate) },
    });
  }
}
