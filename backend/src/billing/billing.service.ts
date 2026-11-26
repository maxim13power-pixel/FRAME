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
   * ⭐ №405: авторизация PDF-экспорта.
   *  • содержимое документа хешируется (проект + фильтры + число строк + перечень строк);
   *  • повтор с тем же документом в том же месяце НЕ списывает второй раз (idempotency);
   *  • другой документ — новое списание, поэтому «одним токеном 15 минут печатать всё» нельзя;
   *  • лимит строк на документ проверяется по тарифу;
   *  • знак и лимит строк приходят с сервера, а не из клиентского конфига.
   */
  async authorizePdfExport(
    userId: number,
    input: { projectId: number; materialIds?: number[]; search?: string; categoryId?: number; rowCount: number },
    now: Date = new Date(),
  ): Promise<{
    allowed: boolean;
    code?: 'LIMIT_PDF' | 'LIMIT_EXPORT_ROWS';
    used: number;
    limit: number;
    left: number;
    maxRows: number;
    watermark: boolean;
    token?: string;
    expiresAt?: string;
    reused?: boolean;
  }> {
    const sub = await this.ensureSubscription(userId);
    const plan = await this.getPlan(this.resolvePlanCode(sub, now));
    const key = periodKey(now);
    const used = this.pdfUsed(sub, now);

    // 1. Лимит строк в документе — до всякого списания
    if (input.rowCount > plan.maxExportRows) {
      return {
        allowed: false,
        code: 'LIMIT_EXPORT_ROWS',
        used,
        limit: plan.maxPdfPerMonth,
        left: Math.max(0, plan.maxPdfPerMonth - used),
        maxRows: plan.maxExportRows,
        watermark: plan.priceMonthly === 0,
      };
    }

    // 2. Хеш содержимого: одинаковый документ = одна авторизация
    const canonical = JSON.stringify({
      projectId: input.projectId,
      materialIds: input.materialIds?.length ? [...input.materialIds].sort((a, b) => a - b) : null,
      search: input.search?.trim().toLowerCase() || null,
      categoryId: input.categoryId ?? null,
      rowCount: input.rowCount,
    });
    const payloadHash = createHash('sha256').update(canonical).digest('hex');

    // 3. Пытаемся «застолбить» авторизацию: уникальный индекс не даст списать дважды
    const inserted = await this.prisma.$queryRaw<Array<{ id: number }>>`
      INSERT INTO "pdf_export_authorizations" ("userId", "periodKey", "payloadHash")
      VALUES (${userId}, ${key}, ${payloadHash})
      ON CONFLICT ("userId", "periodKey", "payloadHash") DO NOTHING
      RETURNING "id"
    `;

    const watermark = plan.priceMonthly === 0;
    const expiresAt = new Date(now.getTime() + 15 * 60 * 1000);

    // 4. Уже авторизовали этот документ в этом месяце — отдаём токен без списания
    if (inserted.length === 0) {
      const fresh = await this.getSubscription(userId);
      const freshUsed = this.pdfUsed(fresh, now);
      return {
        allowed: true,
        used: freshUsed,
        limit: plan.maxPdfPerMonth,
        left: Math.max(0, plan.maxPdfPerMonth - freshUsed),
        maxRows: plan.maxExportRows,
        watermark,
        token: this.signExportToken(userId, key, payloadHash, expiresAt.getTime()),
        expiresAt: expiresAt.toISOString(),
        reused: true,
      };
    }

    // 5. Новая авторизация — атомарно списываем (не больше лимита)
    const consumed = await this.consumePdfExport(userId, now);
    if (!consumed || !consumed.allowed) {
      // лимит исчерпан — освобождаем «застолблённую» строку, чтобы она не блокировала повтор
      await this.prisma.pdfExportAuthorization.deleteMany({ where: { userId, periodKey: key, payloadHash } });
      const fresh = await this.getSubscription(userId);
      const freshUsed = this.pdfUsed(fresh, now);
      return {
        allowed: false,
        code: 'LIMIT_PDF',
        used: freshUsed,
        limit: plan.maxPdfPerMonth,
        left: 0,
        maxRows: plan.maxExportRows,
        watermark,
      };
    }

    return {
      allowed: true,
      used: consumed.used,
      limit: consumed.limit,
      left: consumed.left,
      maxRows: plan.maxExportRows,
      watermark,
      token: this.signExportToken(userId, key, payloadHash, expiresAt.getTime()),
      expiresAt: expiresAt.toISOString(),
      reused: false,
    };
  }
}

