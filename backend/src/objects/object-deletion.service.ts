// backend/src/objects/object-deletion.service.ts
// ⭐ №246: безвозвратное удаление объекта с отсрочкой 30 дней.
// • назначить/отменить может ТОЛЬКО администратор объекта (object_access CUSTOMER, projectId=null);
// • до истечения срока объект возвращается («Вернуть» очищает срок);
// • при окончательном удалении каждый ДРУГОЙ активный участник получает личную копию
//   объекта (проекты, сметы, фиксации, склад, бригады, отчёты) — БЕЗ фото,
//   как решил владелец. Фото-файлы удаляются вместе с объектом.
import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { AccessRole, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { createPhotoStorage } from '../photos/photo-storage';

export const DELETION_GRACE_DAYS = 30;
const DAY_MS = 86_400_000;

/** Сколько дней осталось до удаления (0 = сегодня/просрочено). */
export function deletionDaysLeft(
  deleteAfter: Date,
  now: Date = new Date(),
): number {
  return Math.max(0, Math.ceil((deleteAfter.getTime() - now.getTime()) / DAY_MS));
}

/** Участник, для которого делаем копию (сырые поля object_access). */
export interface DeletionAccess {
  userId: number;
  projectId: number | null;
  role: AccessRole | string;
  hidePrices: boolean;
  isHidden: boolean;
  revokedAt: Date | null;
}

/** Типы источника для копирования (Prisma include). */
export type SourceProject = Prisma.ProjectGetPayload<{
  include: { materials: { include: { fixes: true } } };
}>;
export type SourceWarehouse = Prisma.WarehouseItemGetPayload<{
  include: { transactions: true };
}>;
export type SourceBrigade = Prisma.BrigadeGetPayload<{
  include: { members: true; shifts: { include: { members: true } } };
}>;
export type SourceReport = Prisma.ReportGetPayload<{ include: { items: true } }>;

/**
 * Кому делаем копии: все активные (не отозванные) участники, кроме инициатора удаления.
 * Повторяющиеся записи (объектная + проектные) схлопываются в одного человека.
 */
export function copyRecipients(
  accesses: DeletionAccess[],
  requesterId: number | null,
): number[] {
  const ids = new Set<number>();
  for (const a of accesses) {
    if (a.revokedAt) continue;
    if (requesterId != null && a.userId === requesterId) continue;
    ids.add(a.userId);
  }
  return [...ids];
}

/**
 * Какие проекты попадут в копию участника:
 * null — доступ на весь объект (копируем все проекты),
 * иначе — только проекты, к которым у него был точечный доступ.
 */
export function projectIdsForParticipant(
  accesses: DeletionAccess[],
  userId: number,
): number[] | null {
  const own = accesses.filter((a) => a.userId === userId && !a.revokedAt);
  if (own.some((a) => a.projectId == null)) return null;
  return [
    ...new Set(
      own
        .map((a) => a.projectId)
        .filter((id): id is number => typeof id === 'number'),
    ),
  ];
}

@Injectable()
export class ObjectDeletionService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ObjectDeletionService.name);
  private readonly storage = createPhotoStorage();
  private timer?: NodeJS.Timeout;
  private purging = false;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    // Раз в час + один прогон после старта (если приложение простаивало).
    this.timer = setInterval(() => {
      void this.purgeExpired().catch((error) =>
        this.logger.error(
          `Ошибка фоновой уборки: ${
            error instanceof Error ? error.message : String(error)
          }`,
        ),
      );
    }, 60 * 60 * 1000);
    this.timer.unref?.();
    void this.purgeExpired().catch((error) =>
      this.logger.error(
        `Ошибка уборки при старте: ${
          error instanceof Error ? error.message : String(error)
        }`,
      ),
    );
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  /** Назначить удаление через 30 дней (только админ объекта). */
  async schedule(objectId: number, userId: number) {
    await this.assertAdmin(objectId, userId);
    const now = new Date();
    const deleteAfter = new Date(now.getTime() + DELETION_GRACE_DAYS * DAY_MS);
    await this.prisma.object.update({
      where: { id: objectId },
      data: { deleteRequestedAt: now, deleteAfter, deleteRequestedBy: userId },
    });
    return { deleteAfter, daysLeft: DELETION_GRACE_DAYS };
  }

  /** Отменить запланированное удаление (может любой админ объекта). */
  async cancel(objectId: number, userId: number) {
    await this.assertAdmin(objectId, userId);
    await this.prisma.object.update({
      where: { id: objectId },
      data: { deleteRequestedAt: null, deleteAfter: null, deleteRequestedBy: null },
    });
    return { cancelled: true };
  }

  private async assertAdmin(objectId: number, userId: number): Promise<void> {
    const access = await this.prisma.objectAccess.findFirst({
      where: {
        objectId,
        userId,
        projectId: null,
        role: AccessRole.CUSTOMER,
        revokedAt: null,
      },
      select: { id: true },
    });
    if (!access) {
      throw new ForbiddenException('Удалять объект может только его администратор');
    }
    const exists = await this.prisma.object.findUnique({
      where: { id: objectId },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('Объект не найден');
  }

  /**
   * Уборка истёкших удалений. Вызывается по таймеру и при старте.
   * Ошибка по одному объекту не валит остальные (повторим на следующем прогоне).
   */
  async purgeExpired(
    now: Date = new Date(),
  ): Promise<{ deleted: number; copied: number; failed: number }> {
    if (this.purging) return { deleted: 0, copied: 0, failed: 0 };
    this.purging = true;
    let deleted = 0;
    let copied = 0;
    let failed = 0;
    try {
      const due = await this.prisma.object.findMany({
        where: { deleteAfter: { lte: now } },
        select: { id: true, deleteRequestedBy: true },
      });
      for (const row of due) {
        try {
          const result = await this.purgeObject(row.id, row.deleteRequestedBy);
          deleted += 1;
          copied += result.copied;
        } catch (error) {
          failed += 1;
          this.logger.error(
            `Не удалось окончательно удалить объект ${row.id}: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        }
      }
    } finally {
      this.purging = false;
    }
    return { deleted, copied, failed };
  }

  /** Удалить объект: сначала копии участникам, затем файлы и сама запись. */
  private async purgeObject(
    objectId: number,
    requesterId: number | null,
  ): Promise<{ copied: number }> {
    const object = await this.prisma.object.findUnique({
      where: { id: objectId },
      select: {
        name: true,
        address: true,
        startDate: true,
        endDate: true,
        plannedEndDate: true,
        note: true,
      },
    });
    if (!object) return { copied: 0 };

    const accesses = await this.prisma.objectAccess.findMany({
      where: { objectId },
      select: {
        userId: true,
        projectId: true,
        role: true,
        hidePrices: true,
        isHidden: true,
        revokedAt: true,
      },
    });
    const recipients = copyRecipients(accesses, requesterId);

    // Источник копирования читаем один раз на всех получателей.
    const [projects, warehouse, brigades, reports] = await Promise.all([
      this.prisma.project.findMany({
        where: { objectId },
        include: { materials: { include: { fixes: true } } },
      }),
      this.prisma.warehouseItem.findMany({
        where: { objectId },
        include: { transactions: true },
      }),
      this.prisma.brigade.findMany({
        where: { objectId },
        include: { members: true, shifts: { include: { members: true } } },
      }),
      this.prisma.report.findMany({
        where: { objectId },
        include: { items: true },
      }),
    ]);

    // Фото не копируем (решение владельца) — ключи забираем заранее,
    // а файлы удаляем после успешной транзакции.
    const photos = await this.prisma.materialPhoto.findMany({
      where: { material: { project: { objectId } } },
      select: { fileName: true, thumbName: true },
    });
    const keys = photos.flatMap((p) =>
      [p.fileName, p.thumbName].filter((k): k is string => Boolean(k)),
    );

    // Всё атомарно: либо все копии + удаление оригинала, либо ничего.
    // Иначе при сбое повторный прогон наплодил бы дубли уже скопированным.
    await this.prisma.$transaction(async (tx) => {
      for (const userId of recipients) {
        await this.cloneIntoNewObject(
          tx,
          userId,
          object,
          projects,
          warehouse,
          brigades,
          reports,
          projectIdsForParticipant(accesses, userId),
          accesses,
        );
      }
      // У этих связей onDelete: SetNull — чистим явно, чтобы не оставить сирот.
      await tx.warehouseItem.deleteMany({ where: { objectId } });
      await tx.brigade.deleteMany({ where: { objectId } });
      // Остальное (проекты, материалы, фиксации, фото, отчёты, доступы, заявки) — каскадом.
      await tx.object.delete({ where: { id: objectId } });
    });

    await Promise.all(
      keys.map((key) => this.storage.remove(key).catch(() => undefined)),
    );

    this.logger.log(
      `Объект ${objectId} удалён окончательно; личных копий: ${recipients.length}`,
    );
    return { copied: recipients.length };
  }

  /** Личная копия объекта для одного участника (без фото). */
  async cloneIntoNewObject(
    tx: Prisma.TransactionClient,
    userId: number,
    object: {
      name: string;
      address: string;
      startDate: Date;
      endDate: Date;
      plannedEndDate: Date | null;
      note: string | null;
    },
    projects: SourceProject[],
    warehouse: SourceWarehouse[],
    brigades: SourceBrigade[],
    reports: SourceReport[],
    allowedProjectIds: number[] | null,
    accesses: DeletionAccess[],
  ): Promise<void> {
    const allowed = allowedProjectIds == null ? null : new Set(allowedProjectIds);
    const selected = projects.filter((p) => allowed == null || allowed.has(p.id));

    const copy = await tx.object.create({
        data: {
          name: object.name,
          address: object.address,
          startDate: object.startDate,
          endDate: object.endDate,
          plannedEndDate: object.plannedEndDate,
          note: object.note,
          isArchived: false,
          isDemo: false,
          createdById: userId,
          catalogId: null, // справочник мог быть личным — на копию не тянем
        },
        select: { id: true },
      });

      const projectMap = new Map<number, number>();
      for (const project of selected) {
        const createdProject = await tx.project.create({
          data: {
            name: project.name,
            startDate: project.startDate,
            endDate: project.endDate,
            objectId: copy.id,
            catalogId: null,
            note: project.note,
          },
          select: { id: true },
        });
        projectMap.set(project.id, createdProject.id);

        for (const m of project.materials) {
          await tx.material.create({
            data: {
              name: m.name,
              article: m.article,
              unit: m.unit,
              specQuantity: m.specQuantity,
              totalUsed: m.totalUsed,
              lastEntry: m.lastEntry,
              lastEntryDate: m.lastEntryDate,
              note: m.note,
              progressPercent: m.progressPercent,
              isSpecLocked: m.isSpecLocked,
              priceItemId: m.priceItemId,
              unitPrice: m.unitPrice,
              totalCost: m.totalCost,
              materialItemId: m.materialItemId,
              materialUnitPrice: m.materialUnitPrice,
              materialTotalCost: m.materialTotalCost,
              projectId: createdProject.id,
              fixes: m.fixes.length
                ? {
                    create: m.fixes.map((f) => ({
                      amount: f.amount,
                      note: f.note,
                      fixedAt: f.fixedAt,
                      createdAt: f.createdAt,
                      userId: f.userId,
                      isEdited: f.isEdited,
                      editedAt: f.editedAt,
                    })),
                  }
                : undefined,
            },
          });
        }
      }

      await this.cloneWarehouse(tx, userId, copy.id, warehouse, projectMap);
      await this.cloneBrigades(tx, userId, copy.id, brigades, projectMap);
      await this.cloneReports(tx, userId, copy.id, reports, projectMap);

      // Участник становится единственным — администратором копии.
      // Прежние ограничения сохраняем: скрытые цены и личный архив.
      const grants = accesses.filter((a) => a.userId === userId && !a.revokedAt);
      const hidePrices = grants.some(
        (g) => g.hidePrices || g.role === AccessRole.VIEWER,
      );
      const isHidden = grants.some((g) => g.projectId == null && g.isHidden);
      await tx.objectAccess.create({
        data: {
          userId,
          objectId: copy.id,
          projectId: null,
          role: AccessRole.CUSTOMER,
          hidePrices,
          canCreateProjects: true,
          isHidden,
        },
      });
  }

  private async cloneWarehouse(
    tx: Prisma.TransactionClient,
    userId: number,
    objectId: number,
    items: SourceWarehouse[],
    projectMap: Map<number, number>,
  ): Promise<void> {
    for (const item of items) {
      const created = await tx.warehouseItem.create({
        data: {
          name: item.name,
          unit: item.unit,
          category: item.category,
          quantity: item.quantity,
          price: item.price,
          comment: item.comment,
          objectId,
          createdBy: item.createdBy ?? userId,
          createdAt: item.createdAt,
        },
        select: { id: true },
      });
      for (const t of item.transactions) {
        await tx.warehouseTransaction.create({
          data: {
            warehouseItemId: created.id,
            type: t.type,
            quantity: t.quantity,
            price: t.price,
            projectId:
              t.projectId != null ? projectMap.get(t.projectId) ?? null : null,
            comment: t.comment,
            createdBy: t.createdBy,
            createdAt: t.createdAt,
          },
        });
      }
    }
  }

  private async cloneBrigades(
    tx: Prisma.TransactionClient,
    userId: number,
    objectId: number,
    brigades: SourceBrigade[],
    projectMap: Map<number, number>,
  ): Promise<void> {
    for (const brigade of brigades) {
      const created = await tx.brigade.create({
        data: {
          name: brigade.name,
          specialty: brigade.specialty,
          foremanName: brigade.foremanName,
          phone: brigade.phone,
          objectId,
          comment: brigade.comment,
          createdBy: brigade.createdBy ?? userId,
          createdAt: brigade.createdAt,
        },
        select: { id: true },
      });
      const memberMap = new Map<number, number>();
      for (const member of brigade.members) {
        const createdMember = await tx.brigadeMember.create({
          data: {
            brigadeId: created.id,
            fullName: member.fullName,
            role: member.role,
            phone: member.phone,
            createdAt: member.createdAt,
          },
          select: { id: true },
        });
        memberMap.set(member.id, createdMember.id);
      }
      for (const shift of brigade.shifts) {
        const createdShift = await tx.brigadeShift.create({
          data: {
            brigadeId: created.id,
            projectId:
              shift.projectId != null
                ? projectMap.get(shift.projectId) ?? null
                : null,
            date: shift.date,
            hoursWorked: shift.hoursWorked,
            outputValue: shift.outputValue,
            outputArea: shift.outputArea,
            comment: shift.comment,
            createdBy: shift.createdBy ?? userId,
            createdAt: shift.createdAt,
          },
          select: { id: true },
        });
        for (const sm of shift.members) {
          await tx.brigadeShiftMember.create({
            data: {
              shiftId: createdShift.id,
              memberId:
                sm.memberId != null ? memberMap.get(sm.memberId) ?? null : null,
              fullName: sm.fullName,
              hours: sm.hours,
              createdAt: sm.createdAt,
            },
          });
        }
      }
    }
  }

  /** Отчёты копируем только по проектам, которые попали в копию участника. */
  private async cloneReports(
    tx: Prisma.TransactionClient,
    userId: number,
    objectId: number,
    reports: SourceReport[],
    projectMap: Map<number, number>,
  ): Promise<void> {
    for (const report of reports) {
      const projectId = projectMap.get(report.projectId);
      if (!projectId) continue;
      await tx.report.create({
        data: {
          type: report.type,
          title: report.title,
          projectId,
          objectId,
          totalAmount: report.totalAmount,
          status: report.status,
          comment: report.comment,
          createdBy: report.createdBy ?? userId,
          createdAt: report.createdAt,
          items: report.items.length
            ? {
                create: report.items.map((i) => ({
                  materialId: i.materialId,
                  name: i.name,
                  unit: i.unit,
                  quantity: i.quantity,
                  price: i.price,
                  total: i.total,
                  sortOrder: i.sortOrder,
                })),
              }
            : undefined,
        },
      });
    }
  }
}
