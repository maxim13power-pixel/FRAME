import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AccessRole, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInviteDto } from './dto/create-invite.dto';
import { nanoid } from 'nanoid';

/** ⭐ №345: сколько часов по умолчанию действует ссылка-приглашение (было 7 дней). */
export const DEFAULT_INVITE_TTL_HOURS = 2;

/** ⭐ №341: вес ролей для правил слияния (кто «сильнее») */
const ROLE_WEIGHT: Record<AccessRole, number> = {
  CUSTOMER: 3,
  FOREMAN: 2,
  VIEWER: 1,
};

@Injectable()
export class InviteService {
  constructor(private prisma: PrismaService) {}

  // ⭐ Проверка доступа юзера к объекту
  // Детерминированный резолв: объектный контекст → только общая запись (projectId: null).
  private async checkObjectAccess(objectId: number, userId: number) {
    const access = await this.prisma.objectAccess.findFirst({
      where: { userId, objectId, projectId: null },
    });
    if (!access) {
      throw new NotFoundException('Объект не найден');
    }
    return access;
  }

  // 1. Создать ссылку-приглашение
  async createInviteLink(
    objectId: number,
    dto: CreateInviteDto,
    actorUserId: number,
  ) {
    const myAccess = await this.checkObjectAccess(objectId, actorUserId);

    // Только CUSTOMER и FOREMAN могут создавать ссылки
    if (myAccess.role === 'VIEWER') {
      throw new ForbiddenException(
        'Наблюдатель не может создавать ссылки-приглашения',
      );
    }

    // ⭐ №180: отозванный доступ приглашать не может (семантика №168 — только чтение)
    if (myAccess.revokedAt) {
      throw new ForbiddenException(
        'Доступ отозван: создавать ссылки-приглашения нельзя',
      );
    }

    // ⭐ №180: нельзя выдать роль выше своей — тот же запрет, что в access.service.addAccess.
    // Иначе прораб выпускал ссылку с role=CUSTOMER и любой принимающий получал права администратора.
    if (dto.role === 'CUSTOMER' && myAccess.role !== 'CUSTOMER') {
      throw new ForbiddenException(
        'Только администратор объекта может приглашать с ролью администратора',
      );
    }

    // Проверка что объект существует
    const object = await this.prisma.object.findUnique({
      where: { id: objectId },
    });
    if (!object) {
      throw new NotFoundException('Объект не найден');
    }

    // ⭐ №250: ссылку в конкретный проект выпускает только админ объекта,
    // и проект обязан принадлежать этому объекту.
    if (dto.projectId != null) {
      if (myAccess.role !== 'CUSTOMER') {
        throw new ForbiddenException(
          'Ссылку-приглашение в проект создаёт администратор объекта',
        );
      }
      // ⭐ №304: «Администратор» — объектная роль; в ссылке в проект её не предлагаем
      if (dto.role === 'CUSTOMER') {
        throw new BadRequestException(
          'Для ссылки в проект выберите роль «Прораб» или «Наблюдатель»',
        );
      }
      const project = await this.prisma.project.findFirst({
        where: { id: dto.projectId, objectId },
        select: { id: true },
      });
      if (!project) throw new NotFoundException('Проект не найден');
    }

    // Генерируем URL-safe токен (21 символ)
    const token = nanoid(21);

    // ⭐ №303: «разрешить создавать проекты» — та же нормализация, что у прямой выдачи
    // доступа (access.service): только прораб и только ссылка на весь объект.
    // Выдавать это право может лишь администратор объекта — нельзя делегировать больше, чем имеешь.
    const canCreateProjects =
      dto.projectId == null && dto.role === 'FOREMAN'
        ? !!dto.canCreateProjects
        : false;
    if (canCreateProjects && myAccess.role !== 'CUSTOMER') {
      throw new ForbiddenException(
        'Разрешить создание проектов по ссылке может только администратор объекта',
      );
    }

    return this.prisma.inviteToken.create({
      data: {
        token,
        objectId,
        projectId: dto.projectId ?? null,
        createdBy: actorUserId,
        role: dto.role,
        hidePrices: dto.hidePrices ?? false,
        canCreateProjects,
        // ⭐ №345: по умолчанию ссылка живёт 2 часа (было 7 дней)
        expiresAt: dto.expiresAt
          ? new Date(dto.expiresAt)
          : new Date(Date.now() + DEFAULT_INVITE_TTL_HOURS * 3_600_000),
        maxUses: dto.maxUses ?? null,
      },
      include: {
        creator: {
          select: { id: true, fullName: true, email: true, phone: true },
        },
        object: { select: { id: true, name: true, address: true } },
        project: { select: { id: true, name: true } },
      },
    });
  }

  // 2. Получить список активных ссылок объекта (можно только по проекту)
  async getInviteLinks(objectId: number, userId: number, projectId?: number) {
    const access = await this.checkObjectAccess(objectId, userId);
    if (access.role === 'VIEWER') {
      return []; // VIEWER не видит инвайт-ссылок
    }

    return this.prisma.inviteToken.findMany({
      where: {
        objectId,
        isActive: true,
        ...(projectId != null ? { projectId } : {}),
      },
      include: {
        creator: { select: { id: true, fullName: true } },
        project: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // 3. Отозвать ссылку (деактивировать)
  async revokeInviteLink(objectId: number, inviteId: number, userId: number) {
    await this.checkObjectAccess(objectId, userId);

    const invite = await this.prisma.inviteToken.findFirst({
      where: { id: inviteId, objectId },
    });
    if (!invite) {
      throw new NotFoundException('Ссылка не найдена');
    }

    // Только создатель или администратор объекта может отозвать
    const myAccess = await this.checkObjectAccess(objectId, userId);
    if (invite.createdBy !== userId && myAccess.role !== 'CUSTOMER') {
      throw new ForbiddenException(
        'Только создатель ссылки или администратор объекта может её отозвать',
      );
    }

    return this.prisma.inviteToken.update({
      where: { id: inviteId },
      data: { isActive: false },
    });
  }

  // 4. Публичный эндпоинт: получить информацию о приглашении по токену
  async getInviteByToken(token: string) {
    const invite = await this.prisma.inviteToken.findUnique({
      where: { token },
      include: {
        creator: {
          select: { id: true, fullName: true, email: true, phone: true },
        },
        object: { select: { id: true, name: true, address: true } },
        project: { select: { id: true, name: true } },
      },
    });

    if (!invite || !invite.isActive) {
      throw new NotFoundException('Ссылка не найдена или отозвана');
    }

    // Проверка срока жизни
    if (invite.expiresAt && invite.expiresAt < new Date()) {
      throw new BadRequestException('Срок действия ссылки истёк');
    }

    // Проверка лимита использований
    if (invite.maxUses !== null && invite.usesCount >= invite.maxUses) {
      throw new BadRequestException('Лимит использований ссылки исчерпан');
    }

    return {
      token: invite.token,
      role: invite.role,
      hidePrices: invite.hidePrices,
      // ⭐ №303: страница принятия показывает, что даёт ссылка
      canCreateProjects: invite.canCreateProjects,
      creator: invite.creator,
      object: invite.object,
      project: invite.project,
      expiresAt: invite.expiresAt,
      maxUses: invite.maxUses,
      usesCount: invite.usesCount,
    };
  }

  // 5. Принять приглашение (авторизованный юзер)
  // ⭐ №341: правила слияния доступов:
  //   • есть активный доступ на весь объект → «уже есть доступ», ничего не создаём;
  //   • ссылка в проект, а доступ к проекту уже есть → «уже есть доступ к проекту»;
  //   • ссылка на ОБЪЕКТ, а у человека есть проектные доступы → они удаляются (сливаются
  //     в объектный), роль ставится ровно из ссылки; если это понижение роли — просим
  //     подтверждение (confirmDowngrade), чтобы человек не потерял права молча.
  async acceptInvite(
    token: string,
    userId: number,
    opts: { confirmDowngrade?: boolean } = {},
  ) {
    return this.prisma.$transaction(async (tx) => {
      const invite = await this.loadActiveInvite(tx, token);

      const grants = await tx.objectAccess.findMany({
        where: { userId, objectId: invite.objectId },
        select: {
          id: true,
          projectId: true,
          role: true,
          hidePrices: true,
          canCreateProjects: true,
          revokedAt: true,
        },
        orderBy: { id: 'asc' },
      });
      const live = grants.filter((g) => !g.revokedAt);
      const objectGrant = live.find((g) => g.projectId == null);

      // 1) Доступ на весь объект уже есть.
      // ⭐ №342: если объектная ссылка принесла другие настройки (роль/цены/право создавать
      // проекты) — применяем их: админ меняет доступ ссылкой, а не только «выдаёт впервые».
      if (objectGrant) {
        if (invite.projectId == null) {
          const nextCanCreate =
            invite.role === 'FOREMAN' ? invite.canCreateProjects : false;
          const roleChanged = invite.role !== objectGrant.role;
          const pricesChanged = invite.hidePrices !== objectGrant.hidePrices;
          const canCreateChanged =
            nextCanCreate !== objectGrant.canCreateProjects;
          if (roleChanged || pricesChanged || canCreateChanged) {
            // ⭐ №354: нельзя оставить объект без администратора — если это последний
            // CUSTOMER, понижение по ссылке запрещено (даже если он сам её открыл).
            if (
              roleChanged &&
              objectGrant.role === AccessRole.CUSTOMER &&
              invite.role !== AccessRole.CUSTOMER
            ) {
              const otherCustomers = await tx.objectAccess.count({
                where: {
                  objectId: invite.objectId,
                  projectId: null,
                  role: AccessRole.CUSTOMER,
                  revokedAt: null,
                  id: { not: objectGrant.id },
                },
              });
              if (otherCustomers === 0) {
                throw new BadRequestException(
                  'Вы единственный администратор объекта. По этой ссылке вы потеряете права администратора, и управлять объектом станет некому — действие отменено. Роль может изменить другой администратор.',
                );
              }
            }
            await tx.objectAccess.update({
              where: { id: objectGrant.id },
              data: {
                role: invite.role,
                hidePrices: invite.hidePrices,
                canCreateProjects: nextCanCreate,
              },
            });
            await tx.auditLog.create({
              data: {
                actorId: userId,
                entity: 'object',
                entityId: invite.objectId,
                action: 'access_update_by_link',
                before: {
                  role: objectGrant.role,
                  hidePrices: objectGrant.hidePrices,
                  canCreateProjects: objectGrant.canCreateProjects,
                } as unknown as Prisma.InputJsonValue,
                after: {
                  role: invite.role,
                  hidePrices: invite.hidePrices,
                  canCreateProjects: nextCanCreate,
                  inviteId: invite.id,
                },
              },
            });
            await this.bumpUses(tx, token);
            return {
              updated: true as const,
              objectId: invite.objectId,
              role: invite.role,
              hidePrices: invite.hidePrices,
              message: 'Права обновлены по ссылке',
            };
          }
        }
        return {
          alreadyHasAccess: true as const,
          scope: 'object' as const,
          objectId: invite.objectId,
          role: objectGrant.role,
          message: 'У вас уже есть доступ ко всему объекту и всем его проектам',
        };
      }

      // 2) Ссылка в проект
      if (invite.projectId != null) {
        const sameProject = live.find((g) => g.projectId === invite.projectId);
        if (sameProject) {
          return {
            alreadyHasAccess: true as const,
            scope: 'project' as const,
            objectId: invite.objectId,
            projectId: invite.projectId,
            role: sameProject.role,
            message: 'У вас уже есть доступ к этому проекту',
          };
        }
        await this.createOrRestoreGrant(tx, invite, userId, grants);
        await this.bumpUses(tx, token);
        return {
          message: 'Приглашение принято',
          objectId: invite.objectId,
          projectId: invite.projectId,
          projectName: invite.project?.name ?? null,
          role: invite.role,
        };
      }

      // 3) Ссылка на ОБЪЕКТ: сливаем проектные доступы в один объектный
      const projectGrants = live.filter((g) => g.projectId != null);
      const strongestProjectRole = projectGrants.reduce<AccessRole | null>(
        (acc, g) =>
          acc == null || ROLE_WEIGHT[g.role] > ROLE_WEIGHT[acc] ? g.role : acc,
        null,
      );
      const downgrade =
        strongestProjectRole != null &&
        ROLE_WEIGHT[invite.role] < ROLE_WEIGHT[strongestProjectRole];
      if (downgrade && !opts.confirmDowngrade) {
        const projects = await tx.project.findMany({
          where: {
            id: { in: projectGrants.map((g) => g.projectId as number) },
          },
          select: { name: true },
        });
        throw new ConflictException({
          message:
            'Ссылка даст меньше прав, чем у вас есть сейчас. Подтвердите, чтобы продолжить.',
          requiresConfirmation: true,
          fromRole: strongestProjectRole,
          toRole: invite.role,
          projects: projects.map((p) => p.name),
        });
      }

      if (projectGrants.length > 0) {
        await tx.objectAccess.deleteMany({
          where: { id: { in: projectGrants.map((g) => g.id) } },
        });
        await tx.auditLog.create({
          data: {
            actorId: userId,
            entity: 'object',
            entityId: invite.objectId,
            action: 'access_merge_to_object',
            before: {
              grants: projectGrants,
            } as unknown as Prisma.InputJsonValue,
            after: { role: invite.role, inviteId: invite.id },
          },
        });
      }

      await this.createOrRestoreGrant(tx, invite, userId, grants);
      await this.bumpUses(tx, token);
      return {
        message: 'Приглашение принято',
        objectId: invite.objectId,
        projectId: null,
        projectName: null,
        role: invite.role,
        mergedProjects: projectGrants.length,
      };
    });
  }

  /** Активная ссылка с проверками срока и лимита (для accept и статуса) */
  private async loadActiveInvite(tx: Prisma.TransactionClient, token: string) {
    const invite = await tx.inviteToken.findUnique({
      where: { token },
      include: {
        creator: { select: { id: true, fullName: true } },
        object: { select: { id: true, name: true } },
        project: { select: { id: true, name: true } },
      },
    });
    if (!invite || !invite.isActive) {
      throw new NotFoundException('Ссылка не найдена или отозвана');
    }
    if (invite.expiresAt && invite.expiresAt < new Date()) {
      throw new BadRequestException('Срок действия ссылки истёк');
    }
    if (invite.maxUses !== null && invite.usesCount >= invite.maxUses) {
      throw new BadRequestException('Лимит использований ссылки исчерпан');
    }
    return invite;
  }

  /** Создать запись доступа или восстановить отозванную с той же областью */
  private async createOrRestoreGrant(
    tx: Prisma.TransactionClient,
    invite: {
      objectId: number;
      projectId: number | null;
      role: AccessRole;
      hidePrices: boolean;
      canCreateProjects: boolean;
      createdBy: number;
    },
    userId: number,
    grants: { id: number; projectId: number | null; revokedAt: Date | null }[],
  ) {
    const canCreateProjects =
      invite.projectId == null && invite.role === 'FOREMAN'
        ? invite.canCreateProjects
        : false;
    const sameScope = grants.find((g) => g.projectId === invite.projectId);
    if (sameScope) {
      // отозванная запись — восстанавливаем с параметрами ссылки
      await tx.objectAccess.update({
        where: { id: sameScope.id },
        data: {
          role: invite.role,
          hidePrices: invite.hidePrices,
          canCreateProjects,
          revokedAt: null,
          revokedById: null,
          isHidden: false,
          invitedBy: invite.createdBy,
        },
      });
      return;
    }
    await tx.objectAccess.create({
      data: {
        userId,
        objectId: invite.objectId,
        projectId: invite.projectId,
        role: invite.role,
        hidePrices: invite.hidePrices,
        canCreateProjects,
        invitedBy: invite.createdBy,
      },
    });
  }

  /** Учёт использования ссылки */
  private async bumpUses(tx: Prisma.TransactionClient, token: string) {
    await tx.inviteToken.update({
      where: { token },
      data: { usesCount: { increment: 1 } },
    });
  }

  /**
   * ⭐ №341: состояние «а что будет, если я приму ссылку» — для страницы принятия.
   * Возвращает уже имеющийся доступ и предупреждение о понижении роли.
   */
  async inviteStatus(token: string, userId: number) {
    return this.prisma.$transaction(async (tx) => {
      const invite = await this.loadActiveInvite(tx, token);
      const grants = await tx.objectAccess.findMany({
        where: { userId, objectId: invite.objectId },
        select: {
          id: true,
          projectId: true,
          role: true,
          hidePrices: true,
          canCreateProjects: true,
          revokedAt: true,
        },
      });
      const live = grants.filter((g) => !g.revokedAt);
      const objectGrant = live.find((g) => g.projectId == null);
      if (objectGrant) {
        // ⭐ №342: объектная ссылка может поменять роль/цены/право создавать проекты
        if (invite.projectId == null) {
          const nextCanCreate =
            invite.role === 'FOREMAN' ? invite.canCreateProjects : false;
          const changes = {
            role:
              invite.role !== objectGrant.role
                ? { from: objectGrant.role, to: invite.role }
                : null,
            hidePrices:
              invite.hidePrices !== objectGrant.hidePrices
                ? { from: objectGrant.hidePrices, to: invite.hidePrices }
                : null,
            canCreateProjects:
              nextCanCreate !== objectGrant.canCreateProjects
                ? { from: objectGrant.canCreateProjects, to: nextCanCreate }
                : null,
          };
          if (changes.role || changes.hidePrices || changes.canCreateProjects) {
            // ⭐ №354: последний администратор — понижение по ссылке блокируем,
            // чтобы объект не остался без управления (и человек сам себя не закрыл)
            if (
              changes.role &&
              objectGrant.role === AccessRole.CUSTOMER &&
              invite.role !== AccessRole.CUSTOMER
            ) {
              const otherCustomers = await tx.objectAccess.count({
                where: {
                  objectId: invite.objectId,
                  projectId: null,
                  role: AccessRole.CUSTOMER,
                  revokedAt: null,
                  id: { not: objectGrant.id },
                },
              });
              if (otherCustomers === 0) {
                return {
                  alreadyHasAccess: 'object' as const,
                  role: objectGrant.role,
                  blocked: true as const,
                  blockedMessage:
                    'Вы единственный администратор объекта. По этой ссылке вы потеряете права администратора, и управлять объектом станет некому. Роль может изменить другой администратор.',
                };
              }
            }
            return {
              alreadyHasAccess: 'object' as const,
              role: objectGrant.role,
              changes,
            };
          }
        }
        return {
          alreadyHasAccess: 'object' as const,
          role: objectGrant.role,
        };
      }
      if (
        invite.projectId != null &&
        live.some((g) => g.projectId === invite.projectId)
      ) {
        return { alreadyHasAccess: 'project' as const, role: invite.role };
      }
      const projectGrants = live.filter((g) => g.projectId != null);
      const strongest = projectGrants.reduce<AccessRole | null>(
        (acc, g) =>
          acc == null || ROLE_WEIGHT[g.role] > ROLE_WEIGHT[acc] ? g.role : acc,
        null,
      );
      if (
        invite.projectId == null &&
        strongest != null &&
        ROLE_WEIGHT[invite.role] < ROLE_WEIGHT[strongest]
      ) {
        const projects = await tx.project.findMany({
          where: {
            id: { in: projectGrants.map((g) => g.projectId as number) },
          },
          select: { name: true },
        });
        return {
          alreadyHasAccess: null,
          downgrade: {
            fromRole: strongest,
            toRole: invite.role,
            projects: projects.map((p) => p.name),
          },
        };
      }
      return { alreadyHasAccess: null };
    });
  }
}
