// backend/src/access/access.service.ts
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AccessRole, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { assertAccessActive, findLiveAccess } from '../auth/access-scope'; // ⭐ №193 (A₂ F1)
import { AuditService } from '../audit/audit.service'; // ⭐ №131
import { AddAccessDto } from './dto/add-access.dto';
import { UpdateAccessDto } from './dto/update-access.dto';

@Injectable()
export class AccessService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService, // ⭐ №131
  ) {}

  // ⭐ Хелпер: получить запись доступа юзера к объекту (или кинуть 403)
  // Детерминированный резолв: объектный контекст → только общая запись (projectId: null).
  // ⭐ №193 (A₂ F1): отозванный доступ живых данных не читает — ни участников, ни объект.
  private async getMyAccess(objectId: number, userId: number) {
    const access = await findLiveAccess(this.prisma, {
      userId,
      objectId,
      projectId: null,
    });
    if (!access) {
      throw new ForbiddenException('Нет доступа к этому объекту');
    }
    assertAccessActive(access);
    return access;
  }

  // ⭐ №168: управлять командой может администратор объекта или прораб-менеджер (isManager).
  // Отозванный участник сюда не доходит — отзыв режется в getMyAccess (№193).
  private async assertManager(objectId: number, userId: number) {
    const my = await this.getMyAccess(objectId, userId);
    const canManage =
      my.role === AccessRole.CUSTOMER ||
      (my.role === AccessRole.FOREMAN && my.isManager);
    if (!canManage) {
      throw new ForbiddenException(
        'Управлять участниками может администратор объекта или прораб-менеджер',
      );
    }
    return my;
  }

  // ⭐ №182: делегировать можно только то, что есть у тебя.
  // Если цены скрыты у самого актора — он не может «открыть» их другому.
  private assertCanDelegatePrices(
    my: { hidePrices?: boolean },
    hidePrices?: boolean,
  ) {
    if (hidePrices === false && my.hidePrices) {
      throw new ForbiddenException(
        'У вас скрыты цены — вы не можете открыть их другому участнику',
      );
    }
  }

  // ⭐ Хелпер: найти приглашаемого юзера (по userId / email / телефону)
  private async resolveUser(dto: AddAccessDto) {
    if (dto.userId) {
      const user = await this.prisma.user.findUnique({
        where: { id: dto.userId },
      });
      if (!user) throw new NotFoundException('Пользователь не найден');
      return user;
    }
    if (dto.email) {
      const user = await this.prisma.user.findUnique({
        where: { email: dto.email.trim().toLowerCase() },
      });
      if (!user)
        throw new NotFoundException('Пользователь с таким email не найден');
      return user;
    }
    if (dto.phone) {
      const user = await this.prisma.user.findUnique({
        where: { phone: dto.phone.trim() },
      });
      if (!user)
        throw new NotFoundException('Пользователь с таким телефоном не найден');
      return user;
    }
    throw new BadRequestException('Укажите userId, email или телефон');
  }

  // 1. Список участников объекта (для модалки «Управление доступом»)
  async getAccessList(objectId: number, userId: number) {
    await this.getMyAccess(objectId, userId); // проверка доступа
    return this.prisma.objectAccess.findMany({
      where: { objectId },
      include: {
        user: {
          select: { id: true, fullName: true, email: true, phone: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  // 2. Пригласить пользователя (ТЗ 3.5)
  // ⭐ №168: если запись уже есть и была отозвана — это «вернуть доступ» одним действием,
  // без повторного приглашения и без создания дубля.
  async addAccess(objectId: number, dto: AddAccessDto, actorUserId: number) {
    const myAccess = await this.assertManager(objectId, actorUserId);

    // Только администратор объекта может выдать роль администратора или права менеджера.
    if (
      (dto.role === AccessRole.CUSTOMER || dto.isManager) &&
      myAccess.role !== AccessRole.CUSTOMER
    ) {
      throw new ForbiddenException(
        'Только администратор объекта может выдать роль администратора или права менеджера',
      );
    }

    // ⭐ №182: нельзя открыть другому цены, которые скрыты у тебя самого
    this.assertCanDelegatePrices(myAccess, dto.hidePrices);

    // Найти приглашаемого юзера
    const invitedUser = await this.resolveUser(dto);

    // ⭐ Нельзя пригласить самого себя
    if (invitedUser.id === actorUserId) {
      throw new BadRequestException('Нельзя пригласить самого себя');
    }

    const projectId = dto.projectId ?? null;
    // ⭐ Уникальность держит частичный индекс (COALESCE(projectId,0)) — ищем вручную,
    // чтобы NULL-safe вернуть отозванного, а не ловить P2002.
    const existing = await this.prisma.objectAccess.findFirst({
      where: { userId: invitedUser.id, objectId, projectId },
    });

    if (existing) {
      if (!existing.revokedAt) {
        throw new ConflictException(
          'У этого пользователя уже есть доступ к объекту',
        );
      }
      const restored = await this.prisma.objectAccess.update({
        where: { id: existing.id },
        data: {
          revokedAt: null,
          revokedById: null,
          isHidden: false,
          role: dto.role,
          isManager: dto.role === AccessRole.FOREMAN && !!dto.isManager,
          hidePrices: dto.hidePrices ?? existing.hidePrices,
          invitedBy: actorUserId,
        },
        include: {
          user: {
            select: { id: true, fullName: true, email: true, phone: true },
          },
        },
      });
      await this.audit.log(
        actorUserId,
        'object_access',
        objectId,
        'restore',
        { userId: invitedUser.id, revokedAt: existing.revokedAt },
        {
          userId: invitedUser.id,
          role: dto.role,
          isManager: restored.isManager,
          hidePrices: restored.hidePrices,
        },
      );
      return restored;
    }

    const created = await this.prisma.objectAccess.create({
      data: {
        userId: invitedUser.id,
        objectId,
        projectId, // null = весь объект
        role: dto.role,
        isManager: dto.role === AccessRole.FOREMAN && !!dto.isManager,
        hidePrices: dto.hidePrices ?? false,
        invitedBy: actorUserId,
      },
      include: {
        user: {
          select: { id: true, fullName: true, email: true, phone: true },
        },
      },
    });
    // ⭐ №131: журнал выдачи доступа
    await this.audit.log(
      actorUserId,
      'object_access',
      objectId,
      'create',
      undefined,
      { userId: invitedUser.id, role: dto.role, isManager: created.isManager, hidePrices: created.hidePrices },
    );
    return created;
  }
  // 3. Сменить роль участника и/или права менеджера
  async updateAccess(
    objectId: number,
    accessId: number,
    dto: UpdateAccessDto,
    actorUserId: number,
  ) {
    const myAccess = await this.assertManager(objectId, actorUserId);

    const target = await this.prisma.objectAccess.findFirst({
      where: { id: accessId, objectId },
    });
    if (!target) {
      throw new NotFoundException('Запись доступа не найдена');
    }
    if (target.userId === actorUserId) {
      throw new BadRequestException('Нельзя менять собственный доступ');
    }
    if (target.revokedAt) {
      throw new BadRequestException(
        'Доступ отозван — сначала верните его, потом меняйте роль',
      );
    }

    // Прораб-менеджер не трогает администраторов объекта и не повышает никого до администратора объекта.
    if (myAccess.role !== AccessRole.CUSTOMER) {
      if (
        target.role === AccessRole.CUSTOMER ||
        dto.role === AccessRole.CUSTOMER
      ) {
        throw new ForbiddenException(
          'Только администратор объекта может менять роль администратора',
        );
      }
      if (dto.isManager) {
        throw new ForbiddenException(
          'Только администратор объекта может назначать прорабов-менеджеров',
        );
      }
    }

    const nextRole = dto.role ?? target.role;
    const nextManager = dto.isManager ?? target.isManager;
    const nextHidePrices = dto.hidePrices ?? target.hidePrices;

    // ⭐ №182: открыть цены другому может только тот, у кого они не скрыты
    this.assertCanDelegatePrices(myAccess, dto.hidePrices);

    // ⭐ №181: последнего администратора объекта нельзя понизить (инвариант «≥1 администратор»).
    // Раньше проверка стояла только на отзыве и удалении доступа — понижение роли её обходило.
    if (target.role === AccessRole.CUSTOMER && nextRole !== AccessRole.CUSTOMER) {
      await this.assertNotLastCustomer(objectId, target);
    }

    if (nextManager && nextRole !== AccessRole.FOREMAN) {
      throw new BadRequestException('Права менеджера доступны только прорабу');
    }

    const updated = await this.prisma.objectAccess.update({
      where: { id: accessId },
      data: {
        role: nextRole,
        isManager: nextManager,
        hidePrices: nextHidePrices,
      },
      include: {
        user: {
          select: { id: true, fullName: true, email: true, phone: true },
        },
      },
    });
    // ⭐ №131: журнал смены роли/прав
    await this.audit.log(
      actorUserId,
      'object_access',
      objectId,
      'update',
      {
        userId: target.userId,
        role: target.role,
        isManager: target.isManager,
        hidePrices: target.hidePrices,
      },
      {
        userId: target.userId,
        role: nextRole,
        isManager: nextManager,
        hidePrices: nextHidePrices,
      },
    );
    return updated;
  }

  // 4. Отозвать доступ — МЯГКО: read-only + снимок в личных шаблонах.
  // Данные не удаляются: акты/склад/авторство остаются, человек видит «как было».
  async revokeAccess(objectId: number, accessId: number, actorUserId: number) {
    const myAccess = await this.assertManager(objectId, actorUserId);

    const target = await this.prisma.objectAccess.findFirst({
      where: { id: accessId, objectId },
    });
    if (!target) {
      throw new NotFoundException('Запись доступа не найдена');
    }
    if (target.userId === actorUserId) {
      throw new BadRequestException('Нельзя отозвать собственный доступ');
    }
    if (target.revokedAt) {
      throw new BadRequestException('Доступ уже отозван');
    }
    if (
      myAccess.role === AccessRole.FOREMAN &&
      target.role === AccessRole.CUSTOMER
    ) {
      throw new ForbiddenException('Прораб не может отозвать доступ администратора объекта');
    }
    await this.assertNotLastCustomer(objectId, target);

    const now = new Date();
    // Снимок и отзыв — в одной транзакции: либо есть копия, либо доступ остаётся.
    const snapshot = await this.prisma.$transaction(async (tx) => {
      const created = await this.createSnapshot(tx, target, now);
      await tx.objectAccess.update({
        where: { id: accessId },
        data: { revokedAt: now, revokedById: actorUserId },
      });
      return created;
    });

    // ⭐ №131: журнал отзыва доступа
    await this.audit.log(
      actorUserId,
      'object_access',
      objectId,
      'revoke',
      { userId: target.userId, role: target.role },
      { userId: target.userId, revokedAt: now, ...snapshot },
    );
    return { success: true, revokedAt: now, ...snapshot };
  }

  // 5. Вернуть доступ одним кликом (без повторного приглашения)
  async restoreAccess(objectId: number, accessId: number, actorUserId: number) {
    const myAccess = await this.assertManager(objectId, actorUserId);

    const target = await this.prisma.objectAccess.findFirst({
      where: { id: accessId, objectId },
    });
    if (!target) {
      throw new NotFoundException('Запись доступа не найдена');
    }
    if (!target.revokedAt) {
      throw new BadRequestException('Доступ не был отозван');
    }
    if (
      myAccess.role === AccessRole.FOREMAN &&
      target.role === AccessRole.CUSTOMER
    ) {
      throw new ForbiddenException(
        'Прораб не может вернуть доступ администратору объекта — это делает администратор объекта',
      );
    }

    const updated = await this.prisma.objectAccess.update({
      where: { id: accessId },
      data: { revokedAt: null, revokedById: null },
      include: {
        user: {
          select: { id: true, fullName: true, email: true, phone: true },
        },
      },
    });
    await this.audit.log(
      actorUserId,
      'object_access',
      objectId,
      'restore',
      { userId: target.userId, revokedAt: target.revokedAt },
      { userId: target.userId, revokedAt: null },
    );
    return updated;
  }

  // 6. Удалить запись доступа навсегда (после отзыва)
  async purgeAccess(objectId: number, accessId: number, actorUserId: number) {
    const myAccess = await this.assertManager(objectId, actorUserId);

    const target = await this.prisma.objectAccess.findFirst({
      where: { id: accessId, objectId },
    });
    if (!target) {
      throw new NotFoundException('Запись доступа не найдена');
    }
    if (target.userId === actorUserId) {
      throw new BadRequestException('Нельзя удалить собственный доступ');
    }
    if (
      myAccess.role === AccessRole.FOREMAN &&
      target.role === AccessRole.CUSTOMER
    ) {
      throw new ForbiddenException('Прораб не может удалить доступ администратора объекта');
    }
    await this.assertNotLastCustomer(objectId, target);

    await this.prisma.objectAccess.delete({ where: { id: accessId } });
    await this.audit.log(actorUserId, 'object_access', objectId, 'delete', {
      userId: target.userId,
      role: target.role,
      revokedAt: target.revokedAt,
    });
    return { success: true };
  }

  // ⭐ №168: нельзя остаться без администратора объекта (инвариант И1)
  private async assertNotLastCustomer(
    objectId: number,
    target: { userId: number; role: AccessRole; projectId: number | null },
  ) {
    if (target.role !== AccessRole.CUSTOMER || target.projectId != null) return;
    const others = await this.prisma.objectAccess.count({
      where: {
        objectId,
        projectId: null,
        role: AccessRole.CUSTOMER,
        revokedAt: null,
        userId: { not: target.userId },
      },
    });
    if (others === 0) {
      throw new BadRequestException(
        'Это последний администратор объекта — сначала назначьте другого администратора',
      );
    }
  }

  // 7. ⭐ №168: «Мои доступы» — активные / архив / отозванные
  async listMine(userId: number) {
    const rows = await this.prisma.objectAccess.findMany({
      where: { userId },
      include: {
        object: { select: { id: true, name: true, address: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    const projectIds = rows
      .map((r) => r.projectId)
      .filter((id): id is number => id != null);
    const projects = projectIds.length
      ? await this.prisma.project.findMany({
          where: { id: { in: projectIds } },
          select: { id: true, name: true },
        })
      : [];
    const projectNames = new Map(projects.map((p) => [p.id, p.name]));

    return rows.map((r) => ({
      id: r.id,
      objectId: r.objectId,
      objectName: r.object.name,
      objectAddress: r.object.address,
      projectId: r.projectId,
      projectName: r.projectId ? (projectNames.get(r.projectId) ?? null) : null,
      role: r.role,
      isManager: r.isManager,
      isHidden: r.isHidden,
      revokedAt: r.revokedAt,
      createdAt: r.createdAt,
    }));
  }

  // 8. ⭐ №168/№169: личный архив — скрыть/показать объект только у себя.
  // Архив — это свойство ОБЪЕКТА, а не отдельной записи: у одного участника их
  // может быть несколько (весь объект + точечные проекты), поэтому флаг пишем
  // во все его записи этого объекта. Иначе «в настройках архив, а в объектах нет».
  async setHidden(accessId: number, userId: number, isHidden: boolean) {
    const row = await this.prisma.objectAccess.findFirst({
      where: { id: accessId, userId },
      select: { id: true, objectId: true },
    });
    if (!row) {
      throw new NotFoundException('Запись доступа не найдена');
    }
    await this.prisma.objectAccess.updateMany({
      where: { userId, objectId: row.objectId },
      data: { isHidden },
    });
    return { success: true, isHidden, objectId: row.objectId };
  }

  /** dd.mm.yyyy без зависимости от локали сервера */
  private formatDateRu(d: Date): string {
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${dd}.${mm}.${d.getFullYear()}`;
  }

  /**
   * ⭐ №168: снимок данных проекта на момент отзыва.
   * Использует существующие шаблоны смет (№129): name/unit/quantity/unitPrice/
   * materialUnitPrice/priceItemId уже хранятся в EstimateTemplateItem.
   * Справочник цен объекта копируется в ЛИЧНЫЙ справочник участника,
   * чтобы закупочные цены не «исчезали» вместе с доступом.
   */
  private async createSnapshot(
    tx: Prisma.TransactionClient,
    access: { objectId: number; projectId: number | null; userId: number },
    now: Date,
  ) {
    const object = await tx.object.findUnique({
      where: { id: access.objectId },
      select: { id: true, name: true, catalogId: true },
    });
    if (!object) return { templates: 0, catalogCopied: false };

    const projects = await tx.project.findMany({
      where: {
        objectId: access.objectId,
        ...(access.projectId != null ? { id: access.projectId } : {}),
      },
      orderBy: { id: 'asc' },
      select: { id: true, name: true },
    });

    const stamp = this.formatDateRu(now);
    let templates = 0;
    for (const p of projects) {
      const materials = await tx.material.findMany({
        where: { projectId: p.id },
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
      if (materials.length === 0) continue;
      await tx.estimateTemplate.create({
        data: {
          name: `${object.name} · ${p.name} — копия на ${stamp}`,
          ownerId: access.userId,
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
      });
      templates += 1;
    }

    let catalogCopied = false;
    if (object.catalogId) {
      const catalog = await tx.priceCatalog.findUnique({
        where: { id: object.catalogId },
        include: { items: true },
      });
      if (catalog && catalog.items.length > 0) {
        await tx.priceCatalog.create({
          data: {
            name: `${catalog.name} — копия объекта «${object.name}» на ${stamp}`,
            ownerId: access.userId,
            items: {
              create: catalog.items.map((i) => ({
                name: i.name,
                article: i.article,
                unit: i.unit,
                price: i.price,
                categoryId: i.categoryId,
                isActive: i.isActive,
                kind: i.kind,
                ownerId: access.userId,
              })),
            },
          },
        });
        catalogCopied = true;
      }
    }

    return { templates, catalogCopied };
  }
}

