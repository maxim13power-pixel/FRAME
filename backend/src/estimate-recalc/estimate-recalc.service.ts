// backend/src/estimate-recalc/estimate-recalc.service.ts
// ⭐ №170: пересчёт сметы по справочнику цен.
//  • preview  — «было → станет» без записи (план строится один раз и тем же планом пишем);
//  • apply    — меняет ЦЕНЫ строк без фиксаций + снимок версии в AuditLog;
//  • history  — версии пересчёта проекта;
//  • rollback — откат к состоянию ДО выбранной версии (тоже пишется в аудит).
// Объёмы (specQuantity/totalUsed), фиксации, проценты и склад не меняются.
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AccessRole, PriceKind, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { assertAccessActive, findProjectAccess } from '../auth/access-scope'; // ⭐ №193 (A₂ F1)
import { loadCatalogAccess } from '../price-list/catalog-access';
import { findWorkingCatalog } from '../price-list/working-catalog'; // ⭐ №276
import {
  buildRecalcPlan,
  RecalcMaterialRow,
  RecalcPriceRef,
  roundMoney,
} from './recalc-plan';

/** Поля строки сметы, влияющие на пересчёт */
const MATERIAL_SELECT = {
  id: true,
  name: true,
  article: true,
  unit: true,
  specQuantity: true,
  totalUsed: true,
  priceItemId: true,
  unitPrice: true,
  materialItemId: true,
  materialUnitPrice: true,
  // ⭐ №318: норма расхода материала (для материалов в упаковке)
  consumption: true,
  totalCost: true,
  materialTotalCost: true,
} as const;

/** Снимок ценовой части строки — то, что откатываем */
interface PriceSnapshotRow {
  materialId: number;
  unitPrice: number;
  materialUnitPrice: number;
  priceItemId: number | null;
  materialItemId: number | null;
  totalCost: number;
  materialTotalCost: number;
}

/** Строка материала, заблокированная FOR UPDATE в транзакции пересчёта (№276) */
interface LockedMaterialRow {
  id: number;
  totalUsed: number;
  unitPrice: number;
  materialUnitPrice: number;
  priceItemId: number | null;
  materialItemId: number | null;
  totalCost: number;
  materialTotalCost: number;
}

/** Действия пересчёта в AuditLog (entity='project') */
const RECALC_ACTIONS = ['price_recalc', 'price_recalc_rollback'];

@Injectable()
export class EstimateRecalcService {
  constructor(private prisma: PrismaService) {}

  /** Детерминированный резолв: проектная запись → общая на объект (как в materials) */
  private async checkProjectAccess(projectId: number, userId: number) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { objectId: true },
    });
    if (!project) throw new NotFoundException('Проект не найден');
    // ⭐ №193 (A₂ F1): активная запись приоритетнее отозванной, отозванная — 403.
    const access = await findProjectAccess(
      this.prisma,
      userId,
      project.objectId,
      projectId,
    );
    if (!access) throw new NotFoundException('Проект не найден');
    assertAccessActive(access);
    return access;
  }

  private mustHidePrices(
    access?: {
      role?: string;
      hidePrices?: boolean;
      revokedAt?: Date | null;
    } | null,
  ): boolean {
    if (!access) return false;
    if (access.revokedAt) return true;
    if (access.role === AccessRole.VIEWER) return true;
    return access.hidePrices ?? false;
  }

  /**
   * Пересчёт — денежная операция: наблюдателю, отозванному доступу и пользователю
   * с флагом «скрывать цены» она недоступна (иначе он меняет то, чего не видит).
   */
  private assertCanRecalc(access: {
    role?: string;
    hidePrices?: boolean;
    revokedAt?: Date | null;
  }) {
    if (access.revokedAt) {
      throw new ForbiddenException(
        'Доступ отозван: пересчёт сметы недоступен. Снимок данных сохранён в ваших шаблонах.',
      );
    }
    if (access.role === AccessRole.VIEWER) {
      throw new ForbiddenException('Наблюдатель не может менять цены сметы');
    }
    if (access.hidePrices) {
      throw new ForbiddenException(
        'Вам скрыты цены — пересчёт недоступен. Попросите администратора объекта открыть цены.',
      );
    }
  }

  /**
   * Проект + действующий справочник + строки сметы + план пересчёта.
   * Справочник: явный catalogId → свой проекта → справочник объекта (§14).
   */
  private async loadPlan(
    projectId: number,
    userId: number,
    catalogId?: number,
  ) {
    const access = await this.checkProjectAccess(projectId, userId);

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        name: true,
        catalogId: true,
        objectId: true,
        object: { select: { catalogId: true, name: true } },
      },
    });
    if (!project) throw new NotFoundException('Проект не найден');

    // ⭐ №276: явный справочник → привязка проекта → рабочая база пользователя →
    // (легаси) справочник объекта. Рабочую базу только ЧИТАЕМ: привязка проекта
    // происходит при записи цен (материалы/импорт/применение пересчёта).
    const working = await findWorkingCatalog(this.prisma, userId);
    const targetCatalogId =
      catalogId ?? project.catalogId ?? working?.id ?? project.object.catalogId ?? null;
    if (!targetCatalogId) {
      throw new BadRequestException(
        'У проекта не выбран справочник цен — сначала привяжите его в настройках проекта',
      );
    }

    const catalog = await this.prisma.priceCatalog.findUnique({
      where: { id: targetCatalogId },
      select: { id: true, name: true, isArchived: true },
    });
    if (!catalog) {
      throw new NotFoundException('Справочник не найден или нет доступа');
    }
    if (catalog.isArchived) {
      throw new BadRequestException('Справочник в архиве — выберите активный');
    }
    const catalogAccess = await loadCatalogAccess(
      this.prisma,
      catalog.id,
      userId,
    );
    if (!catalogAccess?.canRead) {
      throw new NotFoundException('Справочник не найден или нет доступа');
    }

    const [materials, items] = await Promise.all([
      this.prisma.material.findMany({
        where: { projectId },
        orderBy: { id: 'asc' },
        select: MATERIAL_SELECT,
      }),
      this.prisma.priceItem.findMany({
        where: { catalogId: catalog.id, isActive: true },
        select: {
          id: true,
          name: true,
          article: true,
          unit: true,
          price: true,
          // ⭐ №318: объём упаковки — чтобы посчитать цену на единицу строки
          packSize: true,
          kind: true,
        },
        orderBy: { id: 'asc' },
      }),
    ]);

    const toRef = (item: (typeof items)[number]): RecalcPriceRef => ({
      id: item.id,
      name: item.name,
      article: item.article,
      unit: item.unit,
      price: Number(item.price),
      packSize: item.packSize,
    });

    const works = items.filter((i) => i.kind === PriceKind.WORK).map(toRef);
    const materialPrices = items
      .filter((i) => i.kind === PriceKind.MATERIAL)
      .map(toRef);

    const rows: RecalcMaterialRow[] = materials.map((m) => ({
      id: m.id,
      name: m.name,
      article: m.article,
      unit: m.unit,
      specQuantity: Number(m.specQuantity),
      totalUsed: Number(m.totalUsed),
      priceItemId: m.priceItemId,
      unitPrice: Number(m.unitPrice),
      materialItemId: m.materialItemId,
      materialUnitPrice: Number(m.materialUnitPrice),
    }));

    const plan = buildRecalcPlan(rows, works, materialPrices);

    return {
      access,
      project,
      catalog,
      source:
        catalogId != null
          ? ('manual' as const)
          : project.catalogId != null
            ? ('project' as const)
            : working?.id === targetCatalogId
              ? ('personal' as const)
              : ('object' as const),
      materials,
      plan,
    };
  }

  /** Компактный ответ для фронта: проект, справочник, итоги, строки */
  private present(
    ctx: Awaited<ReturnType<EstimateRecalcService['loadPlan']>>,
    plan = ctx.plan,
  ) {
    return {
      projectId: ctx.project.id,
      projectName: ctx.project.name,
      catalog: {
        id: ctx.catalog.id,
        name: ctx.catalog.name,
        source: ctx.source,
      },
      summary: plan.summary,
      rows: plan.rows,
    };
  }

  /** Превью пересчёта — ничего не пишет */
  async preview(projectId: number, userId: number, catalogId?: number) {
    const ctx = await this.loadPlan(projectId, userId, catalogId);
    if (this.mustHidePrices(ctx.access)) {
      throw new ForbiddenException(
        'Вам скрыты цены — пересчёт недоступен. Попросите администратора объекта открыть цены.',
      );
    }
    return this.present(ctx);
  }

  /**
   * Применение пересчёта.
   * Пишем ТОЛЬКО строки без фиксаций (totalUsed = 0) и только с реальным изменением цены.
   * В той же транзакции сохраняем снимок «до» в AuditLog — он же версия для отката.
   */
  async apply(
    projectId: number,
    catalogId: number | undefined,
    userId: number,
  ) {
    const ctx = await this.loadPlan(projectId, userId, catalogId);
    this.assertCanRecalc(ctx.access);

    const { plan, catalog } = ctx;
    const rowsToApply = plan.rows.filter((r) => r.apply);

    if (rowsToApply.length === 0) {
      return {
        updated: 0,
        auditId: null,
        catalog: {
          id: catalog.id,
          name: catalog.name,
          source: ctx.source,
        },
        summary: plan.summary,
        message:
          plan.summary.withFacts === plan.summary.rows && plan.summary.rows > 0
            ? 'Во всех строках уже есть фиксации — цены не меняем.'
            : 'Менять нечего: цены уже совпадают со справочником.',
      };
    }

    // ⭐ №276: строки блокируем FOR UPDATE и считаем от ЗАБЛОКИРОВАННОГО totalUsed.
    // Иначе параллельная фиксация теряется: пересчёт записал бы totalCost по устаревшему объёму.
    // Снимок «до» и аудит пишем в той же транзакции — откат должен быть точным.
    const result = await this.prisma.$transaction(
      async (tx) => {
        const ids = rowsToApply.map((r) => r.materialId);
        const locked = await tx.$queryRaw<LockedMaterialRow[]>(Prisma.sql`
          SELECT id, "totalUsed", "unitPrice", "materialUnitPrice", "priceItemId",
                 "materialItemId", "totalCost", "materialTotalCost"
          FROM materials WHERE id IN (${Prisma.join(ids)}) FOR UPDATE
        `);
        const lockedById = new Map(locked.map((row) => [row.id, row]));

        const beforeRows: PriceSnapshotRow[] = [];
        const afterRows: PriceSnapshotRow[] = [];
        let skippedFacts = 0;

        for (const row of rowsToApply) {
          const current = lockedById.get(row.materialId);
          if (!current) continue; // строку удалили между превью и применением
          const used = Number(current.totalUsed);
          // Пока показывали превью, могли появиться фиксации — такую строку не трогаем
          if (used > 0) {
            skippedFacts += 1;
            continue;
          }
          beforeRows.push({
            materialId: row.materialId,
            unitPrice: Number(current.unitPrice),
            materialUnitPrice: Number(current.materialUnitPrice),
            priceItemId: current.priceItemId,
            materialItemId: current.materialItemId,
            totalCost: Number(current.totalCost),
            materialTotalCost: Number(current.materialTotalCost),
          });
          afterRows.push({
            materialId: row.materialId,
            unitPrice: row.work.newPrice,
            materialUnitPrice: row.material.newPrice,
            priceItemId: row.work.itemId,
            materialItemId: row.material.itemId,
            totalCost: roundMoney(used * row.work.newPrice),
            materialTotalCost: roundMoney(used * row.material.newPrice),
          });
        }

        if (afterRows.length === 0) {
          return { entry: null, updated: 0, skippedFacts };
        }

        // ⭐ №276: старый проект мог быть без привязки — фиксируем базу, в которую пишем
        if (ctx.project.catalogId == null) {
          await tx.project.update({
            where: { id: projectId },
            data: { catalogId: catalog.id },
          });
        }

        for (const row of afterRows) {
          await tx.material.update({
            where: { id: row.materialId },
            data: {
              unitPrice: row.unitPrice,
              materialUnitPrice: row.materialUnitPrice,
              priceItemId: row.priceItemId,
              materialItemId: row.materialItemId,
              totalCost: row.totalCost,
              materialTotalCost: row.materialTotalCost,
            },
          });
        }

        const entry = await tx.auditLog.create({
          data: {
            actorId: userId,
            entity: 'project',
            entityId: projectId,
            action: 'price_recalc',
            before: {
              catalogId: catalog.id,
              catalogName: catalog.name,
              rows: beforeRows as unknown as Prisma.InputJsonValue,
            },
            after: {
              catalogId: catalog.id,
              catalogName: catalog.name,
              updated: afterRows.length,
              planOld: plan.summary.planOld,
              planNew: plan.summary.planNew,
              delta: plan.summary.delta,
              rows: afterRows as unknown as Prisma.InputJsonValue,
            },
          },
        });
        return { entry, updated: afterRows.length, skippedFacts };
      },
      { timeout: 30_000 },
    );

    const updated = result.updated;
    const skipped = result.skippedFacts > 0 ? ` Пропущено с фиксациями: ${result.skippedFacts}.` : '';
    return {
      updated,
      auditId: result.entry?.id ?? null,
      catalog: {
        id: catalog.id,
        name: catalog.name,
        source: ctx.source,
      },
      summary: plan.summary,
      message:
        updated === 0
          ? 'Пока показывали превью, в строках появились фиксации — цены не меняем.'
          : `Пересчитано строк: ${updated}.${skipped} Откат — в «Истории пересчётов».`,
    };
  }

  /** Версии пересчёта проекта (для отката) */
  async history(projectId: number, userId: number) {
    await this.checkProjectAccess(projectId, userId);

    const logs = await this.prisma.auditLog.findMany({
      where: {
        entity: 'project',
        entityId: projectId,
        action: { in: RECALC_ACTIONS },
      },
      orderBy: { id: 'desc' },
      take: 20,
    });

    const actorIds = [...new Set(logs.map((l) => l.actorId))];
    const users = actorIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: actorIds } },
          select: { id: true, fullName: true, email: true },
        })
      : [];
    const actors = new Map(users.map((u) => [u.id, u]));

    return logs.map((log) => {
      const before = (log.before ?? {}) as Record<string, unknown>;
      const after = (log.after ?? {}) as Record<string, unknown>;
      const actor = actors.get(log.actorId);
      const num = (value: unknown) =>
        typeof value === 'number' ? value : null;
      return {
        id: log.id,
        action: log.action,
        createdAt: log.createdAt,
        actor: actor
          ? { id: actor.id, fullName: actor.fullName, email: actor.email }
          : { id: log.actorId },
        catalogId: num(after.catalogId) ?? num(before.catalogId),
        catalogName:
          (after.catalogName as string | undefined) ??
          (before.catalogName as string | undefined) ??
          null,
        updated: num(after.updated),
        restored: num(after.restored),
        rows: Array.isArray(after.rows) ? (after.rows as unknown[]).length : 0,
        planOld: num(after.planOld),
        planNew: num(after.planNew),
        delta: num(after.delta),
        sourceAuditId: num(after.sourceAuditId),
      };
    });
  }

  /**
   * Откат к состоянию ДО указанной версии: возвращаем цены/ссылки из снимка `before`.
   * Сам откат — тоже версия в аудите, поэтому его можно отменить (симметрично).
   */
  async rollback(projectId: number, auditId: number, userId: number) {
    const access = await this.checkProjectAccess(projectId, userId);
    this.assertCanRecalc(access);

    const entry = await this.prisma.auditLog.findFirst({
      where: {
        id: auditId,
        entity: 'project',
        entityId: projectId,
        action: { in: RECALC_ACTIONS },
      },
    });
    if (!entry) throw new NotFoundException('Версия пересчёта не найдена');

    const saved = ((entry.before ?? {}) as { rows?: unknown }).rows;
    const savedRows: PriceSnapshotRow[] = Array.isArray(saved)
      ? (saved as PriceSnapshotRow[])
      : [];
    if (!savedRows.length) {
      throw new BadRequestException('В этой версии нет данных для отката');
    }

    // Только строки этого проекта и только живые (удалённые пропускаем).
    const materials = await this.prisma.material.findMany({
      where: {
        projectId,
        id: { in: savedRows.map((r) => Number(r.materialId)) },
      },
      select: MATERIAL_SELECT,
    });
    const byId = new Map(materials.map((m) => [m.id, m]));
    const restoreRows = savedRows.filter((r) => byId.has(Number(r.materialId)));
    if (!restoreRows.length) {
      throw new BadRequestException(
        'Строки этой версии уже удалены — откатывать нечего',
      );
    }

    const currentRows: PriceSnapshotRow[] = restoreRows.map((r) => {
      const m = byId.get(Number(r.materialId))!;
      return {
        materialId: m.id,
        unitPrice: Number(m.unitPrice),
        materialUnitPrice: Number(m.materialUnitPrice),
        priceItemId: m.priceItemId,
        materialItemId: m.materialItemId,
        totalCost: Number(m.totalCost),
        materialTotalCost: Number(m.materialTotalCost),
      };
    });

    const targetRows: PriceSnapshotRow[] = restoreRows.map((r) => {
      const used = Number(byId.get(Number(r.materialId))?.totalUsed ?? 0);
      const unitPrice = roundMoney(Number(r.unitPrice));
      const materialUnitPrice = roundMoney(Number(r.materialUnitPrice));
      return {
        materialId: Number(r.materialId),
        unitPrice,
        materialUnitPrice,
        priceItemId: r.priceItemId ?? null,
        materialItemId: r.materialItemId ?? null,
        totalCost: roundMoney(used * unitPrice),
        materialTotalCost: roundMoney(used * materialUnitPrice),
      };
    });

    const created = await this.prisma.$transaction(async (tx) => {
      for (const row of targetRows) {
        await tx.material.update({
          where: { id: row.materialId },
          data: {
            unitPrice: row.unitPrice,
            materialUnitPrice: row.materialUnitPrice,
            priceItemId: row.priceItemId,
            materialItemId: row.materialItemId,
            totalCost: row.totalCost,
            materialTotalCost: row.materialTotalCost,
          },
        });
      }
      return tx.auditLog.create({
        data: {
          actorId: userId,
          entity: 'project',
          entityId: projectId,
          action: 'price_recalc_rollback',
          before: {
            rows: currentRows as unknown as Prisma.InputJsonValue,
            sourceAuditId: auditId,
          },
          after: {
            rows: targetRows as unknown as Prisma.InputJsonValue,
            restored: targetRows.length,
            sourceAuditId: auditId,
          },
        },
      });
    });

    return {
      restored: targetRows.length,
      auditId: created.id,
      sourceAuditId: auditId,
      message: `Возвращены цены строк: ${targetRows.length}.`,
    };
  }
}
