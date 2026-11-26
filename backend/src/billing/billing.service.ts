// backend/src/billing/billing.service.ts
// ⭐ №404 (этап 0): тарифы и использование аккаунта — ТОЛЬКО ЧТЕНИЕ.
// Лимиты ещё не включаются: enforcement появится на этапе 1 за флагом BILLING_ENFORCE.
// Тарифы и лимиты живут в БД (`plans`), см. docs/PRICING.md §2 и scripts/seed-plans.js.
import { Injectable } from '@nestjs/common';
import { Plan, PlanCode, Subscription } from '@prisma/client';
import { createHash, createHmac } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';

/** Часовой пояс биллингового периода (МСК) — счётчики сбрасываются по календарному месяцу. */
export const BILLING_TZ = 'Europe/Moscow';

/** Ключ периода YYYY-MM в МСК: позволяет сбрасывать счётчики лениво, без cron. */
export function periodKey(date: Date = new Date()): string {
  // sv-SE даёт ISO-подобный порядок «год-месяц»
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: BILLING_TZ,
    year: 'numeric',
    month: '2-digit',
  }).format(date);
}

export interface PlanView {
  code: PlanCode;
  name: string;
  priceMonthly: number;
  maxObjects: number;
  maxRows: number;
  maxPhotos: number | null;
  maxStorageMb: number | null;
  maxPdfPerMonth: number;
  maxExportRows: number;
  maxWriters: number;
  maxViewers: number;
  historyMonths: number;
}

export interface UsageView {
  objects: number;
  rows: number;
  photos: number;
  storageMb: number;
  writers: number;
  viewers: number;
  pdfUsed: number;
}

export interface BillingSnapshot {
  plan: PlanView;
  status: Subscription['status'];
  source: Subscription['source'];
  grandfather: boolean;
  periodEnd: Date | null;
  /** включён ли реальный запрет создания (этап 1) */
  enforced: boolean;
  usage: UsageView;
  /** остатки по лимитам */
  left: {
    objects: number;
    rows: number;
    photos: number | null;
    storageMb: number | null;
    pdf: number;
    writers: number;
    viewers: number;
  };
}

const toPlanView = (plan: Plan): PlanView => ({
  code: plan.code,
  name: plan.name,
  priceMonthly: plan.priceMonthly,
  maxObjects: plan.maxObjects,
  maxRows: plan.maxRows,
  maxPhotos: plan.maxPhotos,
  maxStorageMb: plan.maxStorageMb,
  maxPdfPerMonth: plan.maxPdfPerMonth,
  maxExportRows: plan.maxExportRows,
  maxWriters: plan.maxWriters,
  maxViewers: plan.maxViewers,
  historyMonths: plan.historyMonths,
});

@Injectable()
export class BillingService {
  constructor(private readonly prisma: PrismaService) {}

  /** Режим enforcement: off (этап 0) / shadow (считаем и логируем) / on (блокируем). */
  get mode(): 'off' | 'shadow' | 'on' {
    const raw = (process.env.BILLING_ENFORCE || 'off').toLowerCase();
    return raw === 'on' || raw === 'shadow' ? raw : 'off';
  }

  /** Включён ли реальный запрет (только режим on). */
  get enforced(): boolean {
    return this.mode === 'on';
  }

  /**
   * Действующий тариф. Правила:
   *  - grandfather — план навсегда, срок не проверяем;
   *  - истёк periodEnd → FREE (данные не трогаем, только лимиты);
   *  - подписки нет → FREE.
   */
  resolvePlanCode(sub: Subscription | null, now: Date = new Date()): PlanCode {
    if (!sub) return 'FREE';
    if (sub.grandfather) return sub.planCode;
    if (sub.periodEnd && sub.periodEnd.getTime() < now.getTime()) return 'FREE';
    if (sub.status === 'CANCELED') return 'FREE';
    return sub.planCode;
  }

  async getPlan(code: PlanCode): Promise<Plan> {
    const plan = await this.prisma.plan.findUnique({ where: { code } });
    if (plan) return plan;
    // страховка: сиды не применены — ведём себя как Free, но не падаем
    return this.prisma.plan.findUniqueOrThrow({ where: { code: 'FREE' } });
  }

  /** Использованные PDF в текущем периоде (при смене месяца читаем как 0). */
  pdfUsed(sub: Subscription | null | undefined, now: Date = new Date()): number {
    if (!sub) return 0;
    if (sub.pdfPeriod !== periodKey(now)) return 0;
    return sub.pdfUsed;
  }

  async getSubscription(userId: number): Promise<Subscription | null> {
    return this.prisma.subscription.findUnique({ where: { userId } });
  }

  /** Подпись токена авторизации экспорта: exp + короткий хеш + HMAC. */
  private signExportToken(userId: number, key: string, payloadHash: string, exp: number): string {
    const payload = `${userId}|${key}|${payloadHash}|${exp}`;
    const secret = process.env.EXPORT_TOKEN_SECRET || process.env.JWT_SECRET || 'frame-dev';
    return `${exp}.${payloadHash.slice(0, 16)}.${createHmac('sha256', secret).update(payload).digest('hex')}`;
  }

  /**
   * ⭐ №405: гарантирует строку подписки. Новым аккаунтам строки нет (значит Free), но для
   * счётчиков (PDF/мес) она нужна — создаём Free лениво, один раз.
   */
  async ensureSubscription(userId: number): Promise<Subscription> {
    const existing = await this.getSubscription(userId);
    if (existing) return existing;
    return this.prisma.subscription.create({
      data: { userId, planCode: 'FREE', status: 'ACTIVE', source: 'MANUAL' },
    });
  }

  /**
   * Использование аккаунта. Считаем COUNT(*), а не денормализованные счётчики:
   * единственный «настоящий» счётчик — PDF-экспорты за месяц (он в subscriptions).
   * Аккаунт = объекты, где пользователь админ (AccessRole.CUSTOMER).
   */
  async getUsage(userId: number, sub?: Subscription | null): Promise<UsageView> {
    const owned = await this.prisma.objectAccess.findMany({
      where: { userId, role: 'CUSTOMER', revokedAt: null, object: { isArchived: false } },
      select: { objectId: true },
    });
    const objectIds = [...new Set(owned.map((o) => o.objectId))];
    const pdfUsed = this.pdfUsed(sub);

    if (objectIds.length === 0) {
      return { objects: 0, rows: 0, photos: 0, storageMb: 0, writers: 0, viewers: 0, pdfUsed };
    }

    const [rows, photoAgg, members] = await Promise.all([
      this.prisma.material.count({ where: { project: { objectId: { in: objectIds } } } }),
      this.prisma.materialPhoto.aggregate({
        where: { material: { project: { objectId: { in: objectIds } } } },
        _count: { _all: true },
        _sum: { sizeBytes: true },
      }),
      this.prisma.objectAccess.findMany({
        where: { objectId: { in: objectIds }, userId: { not: userId }, revokedAt: null },
        select: { userId: true, role: true },
      }),
    ]);

    const others = members.filter((m) => m.userId !== userId); // владелец не считается участником
    const writers = new Set(others.filter((m) => m.role !== 'VIEWER').map((m) => m.userId)).size;
    const viewers = new Set(others.filter((m) => m.role === 'VIEWER').map((m) => m.userId)).size;

    return {
      objects: objectIds.length,
      rows,
      photos: photoAgg._count._all,
      storageMb: Math.round((photoAgg._sum.sizeBytes ?? 0) / (1024 * 1024)),
      writers,
      viewers,
      pdfUsed,
    };
  }

  async getSnapshot(userId: number): Promise<BillingSnapshot> {
    const sub = await this.getSubscription(userId);
    const plan = await this.getPlan(this.resolvePlanCode(sub));
    const usage = await this.getUsage(userId, sub);
    const leftOf = (max: number | null, used: number) => (max == null ? null : Math.max(0, max - used));

    return {
      plan: toPlanView(plan),
      status: sub?.status ?? 'ACTIVE',
      source: sub?.source ?? 'MANUAL',
      grandfather: sub?.grandfather ?? false,
      periodEnd: sub?.periodEnd ?? null,
      enforced: this.enforced,
      usage,
      left: {
        objects: Math.max(0, plan.maxObjects - usage.objects),
        rows: Math.max(0, plan.maxRows - usage.rows),
        photos: leftOf(plan.maxPhotos, usage.photos),
        storageMb: leftOf(plan.maxStorageMb, usage.storageMb),
        pdf: Math.max(0, plan.maxPdfPerMonth - usage.pdfUsed),
        writers: Math.max(0, plan.maxWriters - usage.writers),
        viewers: Math.max(0, plan.maxViewers - usage.viewers),
      },
    };
  }

  /**
   * Списывает один PDF-экспорт АТОМАРНО (без гонок на границе лимита и месяца).
   * Один UPDATE: сброс периода, если месяц сменился, + инкремент, но только пока не достигнут
   * лимит. Ноль обновлённых строк = лимит исчерпан (или подписки нет).
   * Подключится на этапе 1 (`POST /exports/pdf/authorize`, docs/PRICING.md §8).
   */
  async consumePdfExport(
    userId: number,
    now: Date = new Date(),
  ): Promise<{ allowed: boolean; used: number; limit: number; left: number } | null> {
    const sub = await this.getSubscription(userId);
    if (!sub) return null;
    const plan = await this.getPlan(this.resolvePlanCode(sub, now));
    const key = periodKey(now);

    // CASE WHEN — «новый месяц → начинаем с 1», иначе +1. WHERE не пускает сверх лимита.
    const rows = await this.prisma.$queryRaw<Array<{ pdfUsed: number }>>`
      UPDATE "subscriptions"
         SET "pdfUsed" = CASE WHEN "pdfPeriod" = ${key} THEN "pdfUsed" + 1 ELSE 1 END,
             "pdfPeriod" = ${key},
             "updatedAt" = now()
       WHERE "userId" = ${userId}
         AND (CASE WHEN "pdfPeriod" = ${key} THEN "pdfUsed" ELSE 0 END) < ${plan.maxPdfPerMonth}
      RETURNING "pdfUsed"
    `;

    if (rows.length === 0) {
      const current = await this.getSubscription(userId);
      const used = this.pdfUsed(current, now);
      return { allowed: false, used, limit: plan.maxPdfPerMonth, left: 0 };
    }
    const used = rows[0].pdfUsed;
    return {
      allowed: true,
      used,
      limit: plan.maxPdfPerMonth,
      left: Math.max(0, plan.maxPdfPerMonth - used),
    };
  }

  /**
   * ⭐ №406: чей аккаунт платит за экспорт. Квота — владельца объекта (роль CUSTOMER),
   * а не того, кто нажал печать: приглашённый прораб печатает за счёт плана владельца.
   * null — если у пользователя нет доступа к проекту.
   */
  async resolveProjectAccount(
    userId: number,
    projectId: number,
  ): Promise<{ accountId: number; objectId: number } | null> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { objectId: true },
    });
    if (!project) return null;

    const access = await this.prisma.objectAccess.findFirst({
      where: { objectId: project.objectId, userId, revokedAt: null },
      select: { id: true },
    });
    if (!access) return null;

    const owner = await this.prisma.objectAccess.findFirst({
      where: { objectId: project.objectId, role: 'CUSTOMER', revokedAt: null },
      select: { userId: true },
      orderBy: { id: 'asc' },
    });

    return { accountId: owner?.userId ?? userId, objectId: project.objectId };
  }

  /** Версия данных проекта: любое изменение строки меняет хеш документа. */
  private async projectDataVersion(
    projectId: number,
  ): Promise<{ rows: number; lastUpdatedAt: string }> {
    const agg = await this.prisma.material.aggregate({
      where: { projectId },
      _count: { _all: true },
      _max: { updatedAt: true },
    });
    return {
      rows: agg._count._all,
      lastUpdatedAt: (agg._max.updatedAt ?? new Date(0)).toISOString(),
    };
  }

  /**
   * ⭐ №405/№406: авторизация PDF-экспорта.
   *  • квота и идемпотентность — по АККАУНТУ владельца объекта;
   *  • `rows` считает сервер, клиенту не доверяем;
   *  • хеш — из серверных данных (проект + фильтры + строки + версия данных);
   *  • столбление и списание — одна транзакция: при лимите ROLLBACK, «бесплатных» столбов нет.
   */
  async authorizePdfExport(
    actorUserId: number,
    input: { projectId: number; materialIds?: number[]; search?: string; categoryId?: number },
    now: Date = new Date(),
  ): Promise<{
    allowed: boolean;
    code?: 'LIMIT_PDF' | 'LIMIT_EXPORT_ROWS' | 'NO_ACCESS';
    accountId?: number;
    used: number;
    limit: number;
    left: number;
    maxRows: number;
    rows: number;
    watermark: boolean;
    token?: string;
    expiresAt?: string;
    reused?: boolean;
  }> {
    const scope = await this.resolveProjectAccount(actorUserId, input.projectId);
    const empty = { used: 0, limit: 0, left: 0, maxRows: 0, rows: 0, watermark: true };
    if (!scope) return { allowed: false, code: 'NO_ACCESS', ...empty };

    const accountId = scope.accountId;
    const sub = await this.ensureSubscription(accountId);
    const plan = await this.getPlan(this.resolvePlanCode(sub, now));
    const key = periodKey(now);
    const usedBefore = this.pdfUsed(sub, now);
    const watermark = plan.priceMonthly === 0;
    const { rows, lastUpdatedAt } = await this.projectDataVersion(input.projectId);

    if (rows > plan.maxExportRows) {
      return {
        allowed: false,
        code: 'LIMIT_EXPORT_ROWS',
        accountId,
        used: usedBefore,
        limit: plan.maxPdfPerMonth,
        left: Math.max(0, plan.maxPdfPerMonth - usedBefore),
        maxRows: plan.maxExportRows,
        rows,
        watermark,
      };
    }

    const canonical = JSON.stringify({
      projectId: input.projectId,
      materialIds: input.materialIds?.length ? [...input.materialIds].sort((a, b) => a - b) : null,
      search: input.search?.trim().toLowerCase() || null,
      categoryId: input.categoryId ?? null,
      rows,
      lastUpdatedAt,
    });
    const payloadHash = createHash('sha256').update(canonical).digest('hex');
    const expiresAt = new Date(now.getTime() + 15 * 60 * 1000);
    const token = this.signExportToken(accountId, key, payloadHash, expiresAt.getTime());

    type StakeResult = { reused: true } | { reused: false; used: number };
    let result: StakeResult;
    try {
      result = await this.prisma.$transaction(async (tx) => {
        const stake = await tx.$queryRaw<Array<{ id: number }>>`
          INSERT INTO "pdf_export_authorizations" ("accountId", "actorUserId", "projectId", "periodKey", "payloadHash")
          VALUES (${accountId}, ${actorUserId}, ${input.projectId}, ${key}, ${payloadHash})
          ON CONFLICT ("accountId", "periodKey", "payloadHash") DO NOTHING
          RETURNING "id"
        `;
        if (stake.length === 0) return { reused: true as const };

        const charge = await tx.$queryRaw<Array<{ pdfUsed: number }>>`
          UPDATE "subscriptions"
             SET "pdfUsed" = CASE WHEN "pdfPeriod" = ${key} THEN "pdfUsed" + 1 ELSE 1 END,
                 "pdfPeriod" = ${key},
                 "updatedAt" = now()
           WHERE "userId" = ${accountId}
             AND (CASE WHEN "pdfPeriod" = ${key} THEN "pdfUsed" ELSE 0 END) < ${plan.maxPdfPerMonth}
          RETURNING "pdfUsed"
        `;
        if (charge.length === 0) throw new Error('PDF_LIMIT');
        return { reused: false as const, used: charge[0].pdfUsed };
      }, { timeout: 15_000 });
    } catch (err) {
      if (err instanceof Error && err.message === 'PDF_LIMIT') {
        const fresh = await this.getSubscription(accountId);
        const freshUsed = this.pdfUsed(fresh, now);
        return {
          allowed: false,
          code: 'LIMIT_PDF',
          accountId,
          used: freshUsed,
          limit: plan.maxPdfPerMonth,
          left: 0,
          maxRows: plan.maxExportRows,
          rows,
          watermark,
        };
      }
      throw err;
    }

    // гигиена: авторизации прошлых месяцев не переиспользуются
    await this.prisma.pdfExportAuthorization
      .deleteMany({ where: { accountId, periodKey: { lt: key } } })
      .catch(() => undefined);

    const used = result.reused
      ? this.pdfUsed(await this.getSubscription(accountId), now)
      : result.used;

    return {
      allowed: true,
      accountId,
      used,
      limit: plan.maxPdfPerMonth,
      left: Math.max(0, plan.maxPdfPerMonth - used),
      maxRows: plan.maxExportRows,
      rows,
      watermark,
      token,
      expiresAt: expiresAt.toISOString(),
      reused: result.reused,
    };
  }
}

