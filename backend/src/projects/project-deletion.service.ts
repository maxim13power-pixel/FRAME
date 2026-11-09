// backend/src/projects/project-deletion.service.ts
// ⭐ №249: безвозвратное удаление проекта с отсрочкой 30 дней (аналог объектов).
// • назначает/отменяет только администратор объекта;
// • каждому активному участнику проекта (объектный доступ или доступ именно к этому
//   проекту) создаётся ЛИЧНЫЙ объект с копией проекта: смета, фиксации, отчёты,
//   складские операции и выходы бригад по этому проекту. Фото НЕ копируются.
import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { AccessRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { createPhotoStorage } from '../photos/photo-storage';
import {
  DeletionAccess,
  ObjectDeletionService,
  SourceBrigade,
  SourceProject,
  SourceReport,
  SourceWarehouse,
} from '../objects/object-deletion.service';

export const PROJECT_DELETION_GRACE_DAYS = 30;
const DAY_MS = 86_400_000;

@Injectable()
export class ProjectDeletionService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ProjectDeletionService.name);
  private readonly storage = createPhotoStorage();
  private timer?: NodeJS.Timeout;
  private purging = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly objectClone: ObjectDeletionService,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => {
      void this.purgeExpired().catch((error) =>
        this.logger.error(
          `Ошибка фоновой уборки проектов: ${
            error instanceof Error ? error.message : String(error)
          }`,
        ),
      );
    }, 60 * 60 * 1000);
    this.timer.unref?.();
    void this.purgeExpired().catch((error) =>
      this.logger.error(
        `Ошибка уборки проектов при старте: ${
          error instanceof Error ? error.message : String(error)
        }`,
      ),
    );
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  /** Назначить удаление проекта через 30 дней (только админ объекта). */
  async schedule(projectId: number, userId: number) {
    await this.assertAdmin(projectId, userId);
    const now = new Date();
    const deleteAfter = new Date(
      now.getTime() + PROJECT_DELETION_GRACE_DAYS * DAY_MS,
    );
    await this.prisma.project.update({
      where: { id: projectId },
      data: { deleteRequestedAt: now, deleteAfter, deleteRequestedBy: userId },
    });
    return { deleteAfter, daysLeft: PROJECT_DELETION_GRACE_DAYS };
  }

  async cancel(projectId: number, userId: number) {
    await this.assertAdmin(projectId, userId);
    await this.prisma.project.update({
      where: { id: projectId },
      data: {
        deleteRequestedAt: null,
        deleteAfter: null,
        deleteRequestedBy: null,
      },
    });
    return { cancelled: true };
  }

  private async assertAdmin(projectId: number, userId: number): Promise<void> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { objectId: true },
    });
    if (!project) throw new NotFoundException('Проект не найден');
    const access = await this.prisma.objectAccess.findFirst({
      where: {
        objectId: project.objectId,
        userId,
        projectId: null,
        role: AccessRole.CUSTOMER,
        revokedAt: null,
      },
      select: { id: true },
    });
    if (!access) {
      throw new ForbiddenException(
        'Удалять проект может только администратор объекта',
      );
    }
  }

  /** Уборка истёкших удалений (раз в час и при старте). */
  async purgeExpired(
    now: Date = new Date(),
  ): Promise<{ deleted: number; copied: number; failed: number }> {
    if (this.purging) return { deleted: 0, copied: 0, failed: 0 };
    this.purging = true;
    let deleted = 0;
    let copied = 0;
    let failed = 0;
    try {
      const due = await this.prisma.project.findMany({
        where: { deleteAfter: { lte: now } },
        select: { id: true, deleteRequestedBy: true },
      });
      for (const row of due) {
        try {
          const result = await this.purgeProject(
            row.id,
            row.deleteRequestedBy,
          );
          deleted += 1;
          copied += result.copied;
        } catch (error) {
          failed += 1;
          this.logger.error(
            `Не удалось окончательно удалить проект ${row.id}: ${
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

  /** Удалить проект: сначала копии участникам, затем запись и фото-файлы. */
  private async purgeProject(
    projectId: number,
    requesterId: number | null,
  ): Promise<{ copied: number }> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        materials: { include: { fixes: true } },
        object: {
          select: {
            name: true,
            address: true,
            startDate: true,
            endDate: true,
            plannedEndDate: true,
          },
        },
      },
    });
    if (!project) return { copied: 0 };

    const accesses = (await this.prisma.objectAccess.findMany({
      where: { objectId: project.objectId, revokedAt: null },
      select: {
        userId: true,
        projectId: true,
        role: true,
        hidePrices: true,
        isHidden: true,
        revokedAt: true,
      },
    })) as DeletionAccess[];

    // Копию получает каждый, кто видит проект: объектный доступ или доступ
    // именно к этому проекту. Инициатора удаления исключаем.
    const recipients = [
      ...new Set(
        accesses
          .filter(
            (a) =>
              !a.revokedAt &&
              (a.projectId == null || a.projectId === projectId) &&
              a.userId !== requesterId,
          )
          .map((a) => a.userId),
      ),
    ];

    // Данные именно этого проекта: складские операции, выходы бригад, отчёты.
    const [warehouse, brigades, reports] = await Promise.all([
      this.prisma.warehouseItem.findMany({
        where: {
          objectId: project.objectId,
          transactions: { some: { projectId } },
        },
        include: { transactions: { where: { projectId } } },
      }),
      this.prisma.brigade.findMany({
        where: {
          objectId: project.objectId,
          shifts: { some: { projectId } },
        },
        include: {
          members: true,
          shifts: { where: { projectId }, include: { members: true } },
        },
      }),
      this.prisma.report.findMany({
        where: { projectId },
        include: { items: true },
      }),
    ]);

    // Фото не копируем — файлы удаляем после успешной транзакции.
    const photos = await this.prisma.materialPhoto.findMany({
      where: { material: { projectId } },
      select: { fileName: true, thumbName: true },
    });
    const keys = photos.flatMap((p) =>
      [p.fileName, p.thumbName].filter((k): k is string => Boolean(k)),
    );

    await this.prisma.$transaction(async (tx) => {
      for (const userId of recipients) {
        await this.objectClone.cloneIntoNewObject(
          tx,
          userId,
          {
            name: project.object.name,
            address: project.object.address,
            startDate: project.object.startDate,
            endDate: project.object.endDate,
            plannedEndDate: project.object.plannedEndDate,
            note: `Личная копия проекта «${project.name}»`,
          },
          [project as SourceProject],
          warehouse as SourceWarehouse[],
          brigades as SourceBrigade[],
          reports as SourceReport[],
          [projectId],
          accesses,
        );
      }
      await tx.project.delete({ where: { id: projectId } });
    });

    await Promise.all(
      keys.map((key) => this.storage.remove(key).catch(() => undefined)),
    );

    this.logger.log(
      `Проект ${projectId} удалён окончательно; личных копий: ${recipients.length}`,
    );
    return { copied: recipients.length };
  }
}
