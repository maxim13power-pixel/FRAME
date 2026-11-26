// backend/src/billing/billing.service.ts
// ⭐ №404 (этап 0): тарифы и использование аккаунта — ТОЛЬКО ЧТЕНИЕ.
// Лимиты ещё не включаются: enforcement появится на этапе 1 за флагом BILLING_ENFORCE.
// Тарифы и лимиты живут в БД (`plans`), см. docs/PRICING.md §2 и scripts/seed-plans.js.
import { Injectable } from '@nestjs/common';
import { Plan, PlanCode, Subscription } from '@prisma/client';
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

  /** Включён ли запрет по лимитам (этап 1). На этапе 0 всегда false. */
  get enforced(): boolean {
    return process.env.BILLING_ENFORCE === 'true';
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
   * Списывает один PDF-экспорт (ленивый сброс периода: pdfPeriod → YYYY-MM МСК).
   * На этапе 0 ниоткуда не вызывается — подключится на этапе 1
   * (`POST /exports/pdf/authorize`, см. docs/PRICING.md §8).
   */
  async consumePdfExport(
    userId: number,
    now: Date = new Date(),
  ): Promise<{ used: number; limit: number; left: number } | null> {
    const sub = await this.getSubscription(userId);
    if (!sub) return null;
    const key = periodKey(now);
    const used = sub.pdfPeriod === key ? sub.pdfUsed + 1 : 1;
    await this.prisma.subscription.update({
      where: { userId },
      data: { pdfUsed: used, pdfPeriod: key },
    });
    const plan = await this.getPlan(this.resolvePlanCode(sub, now));
    return { used, limit: plan.maxPdfPerMonth, left: Math.max(0, plan.maxPdfPerMonth - used) };
  }
}

