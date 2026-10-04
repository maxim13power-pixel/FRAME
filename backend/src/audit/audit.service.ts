// backend/src/audit/audit.service.ts
// ⭐ №131: append-only журнал ключевых действий (кто/когда/что изменил).
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  // ⭐ Записать событие (append-only).
  async log(
    actorId: number,
    entity: string,
    entityId: number,
    action: string,
    before?: unknown,
    after?: unknown,
  ) {
    return this.prisma.auditLog.create({
      data: {
        actorId,
        entity,
        entityId,
        action,
        before: before === undefined ? undefined : (before as any),
        after: after === undefined ? undefined : (after as any),
      },
    });
  }

  // ⭐ Доступ к проекту (детерминированный резолв — как в materials.service).
  private async checkProjectAccess(projectId: number, userId: number) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { objectId: true },
    });
    if (!project) throw new NotFoundException('Проект не найден');
    const access =
      (await this.prisma.objectAccess.findFirst({
        where: { userId, objectId: project.objectId, projectId },
      })) ??
      (await this.prisma.objectAccess.findFirst({
        where: { userId, objectId: project.objectId, projectId: null },
      }));
    if (!access) throw new ForbiddenException('Нет доступа к этому проекту');
    return access;
  }

  // ⭐ Проверка доступа к конкретной сущности журнала.
  private async checkEntityAccess(
    userId: number,
    entity: string,
    entityId: number,
  ) {
    if (entity === 'report') {
      const report = await this.prisma.report.findUnique({
        where: { id: entityId },
        select: { projectId: true },
      });
      if (!report) throw new NotFoundException('Отчёт не найден');
      await this.checkProjectAccess(report.projectId, userId);
      return;
    }
    if (entity === 'material_fix') {
      const material = await this.prisma.material.findUnique({
        where: { id: entityId },
        select: { projectId: true },
      });
      if (!material) throw new NotFoundException('Материал не найден');
      await this.checkProjectAccess(material.projectId, userId);
      return;
    }
    if (entity === 'price_item') {
      const item = await this.prisma.priceItem.findUnique({
        where: { id: entityId },
        select: { ownerId: true },
      });
      if (!item) throw new NotFoundException('Расценка не найдена');
      if (item.ownerId != null && item.ownerId !== userId) {
        throw new ForbiddenException('Нет доступа к этой расценке');
      }
      return;
    }
    if (entity === 'object_access') {
      const access = await this.prisma.objectAccess.findFirst({
        where: { userId, objectId: entityId, projectId: null },
      });
      if (!access) throw new ForbiddenException('Нет доступа к этому объекту');
      return;
    }
    throw new BadRequestException('Неизвестный тип сущности');
  }

  // ⭐ Чтение журнала (с проверкой доступа к сущности).
  async list(userId: number, entity?: string, entityId?: number) {
    if (entity && entityId != null) {
      await this.checkEntityAccess(userId, entity, entityId);
    }
    const where: any = {};
    if (entity) where.entity = entity;
    if (entityId != null) where.entityId = entityId;

    const logs = await this.prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    // ⭐ Подтянуть имена акторов (actorId → fullName/email).
    const actorIds = [...new Set(logs.map((l) => l.actorId))];
    const users = actorIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: actorIds } },
          select: { id: true, fullName: true, email: true },
        })
      : [];
    const byId = new Map(users.map((u) => [u.id, u]));

    return logs.map((l) => {
      const u = byId.get(l.actorId);
      return {
        ...l,
        actor: u ? { id: u.id, fullName: u.fullName, email: u.email } : { id: l.actorId },
      };
    });
  }
}
