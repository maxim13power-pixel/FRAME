// backend/src/access-request/access-request.service.ts
// ⭐ №178: заявки на право создавать проекты в объекте.
// Зачем: участник, приглашённый только в ОДИН проект, получает 403 при создании
// проекта в объекте (projects.service.checkObjectAccess требует запись с projectId = null).
// Он подаёт заявку, админ или менеджер объекта одобряет — появляется объектная
// запись FOREMAN + isManager, и создание проектов становится доступно.
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AccessRole,
  AccessRequestKind,
  AccessRequestStatus,
  Role,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateAccessRequestDto } from './dto/create-access-request.dto';

const REQUEST_INCLUDE = {
  requester: { select: { id: true, fullName: true, email: true, phone: true } },
  reviewer: { select: { id: true, fullName: true } },
  object: { select: { id: true, name: true } },
} as const;

@Injectable()
export class AccessRequestService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  private async isAdmin(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    return user?.role === Role.ADMIN;
  }

  // Менеджер объекта = администратор объекта или прораб-менеджер с ОБЪЕКТНОЙ записью (projectId = null)
  private async isObjectManager(objectId: number, userId: number) {
    const my = await this.prisma.objectAccess.findFirst({
      where: { userId, objectId, projectId: null },
    });
    if (!my || my.revokedAt) return false;
    return (
      my.role === AccessRole.CUSTOMER ||
      (my.role === AccessRole.FOREMAN && my.isManager)
    );
  }

  // ─── Подать заявку ───
  async create(objectId: number, dto: CreateAccessRequestDto, userId: number) {
    const object = await this.prisma.object.findUnique({
      where: { id: objectId },
      select: { id: true, name: true },
    });
    if (!object) throw new NotFoundException('Объект не найден');

    // Доступ к объекту вообще есть? (проектная запись тоже считается)
    const my = await this.prisma.objectAccess.findFirst({
      where: { userId, objectId },
    });
    if (!my) throw new ForbiddenException('Нет доступа к этому объекту');
    if (my.revokedAt) {
      throw new ForbiddenException('Доступ отозван: заявку подать нельзя');
    }
    if (my.role === AccessRole.VIEWER) {
      throw new ForbiddenException(
        'Наблюдатель не может запрашивать права — попросите владельца изменить роль',
      );
    }

    // Уже есть объектная запись с правом записи? Тогда заявка не нужна
    const objectWide = await this.prisma.objectAccess.findFirst({
      where: { userId, objectId, projectId: null },
    });
    if (
      objectWide &&
      !objectWide.revokedAt &&
      objectWide.role !== AccessRole.VIEWER
    ) {
      throw new BadRequestException(
        'У вас уже есть право создавать проекты в этом объекте',
      );
    }

    const kind = dto.kind ?? AccessRequestKind.CREATE_PROJECTS;
    // Одна активная заявка на (объект, заявитель, вид) — держит частичный уникальный индекс
    const pending = await this.prisma.accessRequest.findFirst({
      where: {
        objectId,
        requesterId: userId,
        kind,
        status: AccessRequestStatus.PENDING,
      },
      select: { id: true },
    });
    if (pending) {
      throw new BadRequestException('Заявка уже отправлена и ждёт решения');
    }

    return this.prisma.accessRequest.create({
      data: {
        objectId,
        requesterId: userId,
        kind,
        comment: dto.comment?.trim() || null,
      },
      include: REQUEST_INCLUDE,
    });
  }

  // ─── Мои заявки ───
  async listOutgoing(userId: number) {
    return this.prisma.accessRequest.findMany({
      where: { requesterId: userId },
      include: REQUEST_INCLUDE,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  // ─── Входящие: админ видит всё, менеджер — свои объекты ───
  async listIncoming(userId: number, status?: AccessRequestStatus) {
    const admin = await this.isAdmin(userId);
    const managed = await this.prisma.objectAccess.findMany({
      where: {
        userId,
        projectId: null,
        revokedAt: null,
        OR: [
          { role: AccessRole.CUSTOMER },
          { role: AccessRole.FOREMAN, isManager: true },
        ],
      },
      select: { objectId: true },
    });
    if (!admin && managed.length === 0) return [];
    return this.prisma.accessRequest.findMany({
      where: {
        ...(admin ? {} : { objectId: { in: managed.map((m) => m.objectId) } }),
        ...(status ? { status } : {}),
        // свою заявку в списке «на согласование» не показываем
        requesterId: { not: userId },
      },
      include: REQUEST_INCLUDE,
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      take: 200,
    });
  }

  // ─── Счётчик для бейджа ───
  async pendingCount(userId: number) {
    const rows = await this.listIncoming(userId, AccessRequestStatus.PENDING);
    return { count: rows.length };
  }

  // ─── Заявки конкретного объекта (для модалки «Управление доступом») ───
  async listForObject(objectId: number, userId: number) {
    const admin = await this.isAdmin(userId);
    if (!admin && !(await this.isObjectManager(objectId, userId))) {
      throw new ForbiddenException('Заявки видит админ или менеджер объекта');
    }
    return this.prisma.accessRequest.findMany({
      where: { objectId },
      include: REQUEST_INCLUDE,
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      take: 100,
    });
  }

  // ─── Одобрить ───
  async approve(id: number, userId: number, comment?: string) {
    const request = await this.getRequest(id);
    if (request.requesterId === userId) {
      throw new ForbiddenException('Нельзя согласовать собственную заявку');
    }
    const admin = await this.isAdmin(userId);
    if (!admin && !(await this.isObjectManager(request.objectId, userId))) {
      throw new ForbiddenException('Заявки согласует админ или менеджер объекта');
    }
    if (request.status !== AccessRequestStatus.PENDING) {
      throw new BadRequestException('Заявка уже обработана');
    }

    // Атомарно «забираем» заявку — защита от двойного клика и гонки
    const claimed = await this.prisma.accessRequest.updateMany({
      where: { id, status: AccessRequestStatus.PENDING },
      data: {
        status: AccessRequestStatus.APPROVED,
        reviewedBy: userId,
        reviewedAt: new Date(),
        reviewComment: comment?.trim() || null,
      },
    });
    if (claimed.count === 0) {
      throw new BadRequestException('Заявка уже обработана');
    }

    // Выдаём ОБЪЕКТНУЮ запись — иначе созданный проект будет доступен не целиком
    const existing = await this.prisma.objectAccess.findFirst({
      where: {
        userId: request.requesterId,
        objectId: request.objectId,
        projectId: null,
      },
    });
    if (existing) {
      const keepCustomer = existing.role === AccessRole.CUSTOMER;
      await this.prisma.objectAccess.update({
        where: { id: existing.id },
        data: {
          role: keepCustomer ? AccessRole.CUSTOMER : AccessRole.FOREMAN,
          isManager: keepCustomer ? existing.isManager : true,
          revokedAt: null,
          revokedById: null,
          isHidden: false,
        },
      });
    } else {
      await this.prisma.objectAccess.create({
        data: {
          userId: request.requesterId,
          objectId: request.objectId,
          projectId: null,
          role: AccessRole.FOREMAN,
          isManager: true,
          invitedBy: userId,
        },
      });
    }

    await this.audit.log(
      userId,
      'access_request',
      id,
      'status_change',
      { status: 'PENDING' },
      { status: 'APPROVED', granted: 'object:FOREMAN+manager' },
    );

    return this.prisma.accessRequest.findUnique({
      where: { id },
      include: REQUEST_INCLUDE,
    });
  }

  // ─── Отклонить ───
  async reject(id: number, userId: number, comment?: string) {
    const request = await this.getRequest(id);
    if (request.requesterId === userId) {
      throw new ForbiddenException('Нельзя отклонить собственную заявку');
    }
    const admin = await this.isAdmin(userId);
    if (!admin && !(await this.isObjectManager(request.objectId, userId))) {
      throw new ForbiddenException(
        'Заявки рассматривает админ или менеджер объекта',
      );
    }
    const claimed = await this.prisma.accessRequest.updateMany({
      where: { id, status: AccessRequestStatus.PENDING },
      data: {
        status: AccessRequestStatus.REJECTED,
        reviewedBy: userId,
        reviewedAt: new Date(),
        reviewComment: comment?.trim() || null,
      },
    });
    if (claimed.count === 0) {
      throw new BadRequestException('Заявка уже обработана');
    }
    await this.audit.log(
      userId,
      'access_request',
      id,
      'status_change',
      { status: 'PENDING' },
      { status: 'REJECTED', comment: comment ?? null },
    );
    return this.prisma.accessRequest.findUnique({
      where: { id },
      include: REQUEST_INCLUDE,
    });
  }

  // ─── Отменить свою заявку ───
  async cancel(id: number, userId: number) {
    const request = await this.getRequest(id);
    if (request.requesterId !== userId) {
      throw new ForbiddenException('Отменить заявку может только её автор');
    }
    const claimed = await this.prisma.accessRequest.updateMany({
      where: { id, requesterId: userId, status: AccessRequestStatus.PENDING },
      data: { status: AccessRequestStatus.CANCELLED, reviewedAt: new Date() },
    });
    if (claimed.count === 0) {
      throw new BadRequestException('Заявка уже обработана');
    }
    return this.prisma.accessRequest.findUnique({
      where: { id },
      include: REQUEST_INCLUDE,
    });
  }

  private async getRequest(id: number) {
    const request = await this.prisma.accessRequest.findUnique({ where: { id } });
    if (!request) throw new NotFoundException('Заявка не найдена');
    return request;
  }
}
