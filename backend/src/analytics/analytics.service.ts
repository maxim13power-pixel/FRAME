// backend/src/analytics/analytics.service.ts
// ⭐ Срез 3: аналитика освоения бюджета.
// «Бюджет» (план) = Σ (unitPrice + materialUnitPrice) × specQuantity по материалам проекта,
// «Факт» = Σ (totalCost + materialTotalCost) — как в dashboard.service (полей budget нет в схеме).
// Деньги считаем только по объектам, где юзер ВИДИТ цены (hidePrices=false, role ≠ VIEWER).
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

interface BudgetRow {
  project_id: number;
  name: string;
  budget: number;
  actual: number;
}
interface MoneyRow {
  total_budget: number;
  total_actual: number;
}
interface WarehouseValueRow {
  value: number;
}
interface MonthRow {
  month: Date;
  spent: number;
}

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  // ─── Общий запрос «бюджет/факт по проектам» (опциональный фильтр по объекту) ───
  private budgetRows(userId: number, objectId?: number): Promise<BudgetRow[]> {
    const objectFilter =
      objectId != null && !Number.isNaN(objectId)
        ? Prisma.sql`AND o.id = ${objectId}`
        : Prisma.empty;
    return this.prisma.$queryRaw<BudgetRow[]>`
      SELECT
        p.id AS project_id,
        p.name AS name,
        COALESCE(SUM((m."unitPrice" + m."materialUnitPrice") * m."specQuantity"), 0)::float AS budget,
        COALESCE(SUM(m."totalCost" + m."materialTotalCost"), 0)::float AS actual
      FROM materials m
      INNER JOIN "Project" p ON p.id = m."projectId"
      INNER JOIN "Object" o ON o.id = p."objectId"
      WHERE o."isArchived" = false
        AND EXISTS (
          SELECT 1 FROM object_access oa
          WHERE oa."objectId" = o.id
            AND oa."userId" = ${userId}
            AND oa."hidePrices" = false
            AND oa."role" <> 'VIEWER'
        )
        ${objectFilter}
      GROUP BY p.id, p.name
      ORDER BY actual DESC
    `;
  }

  // ─── 1. Сводка: бюджеты/факт/склад/перерасходы ───
  async getSummary(userId: number) {
    const [moneyRows, warehouseRows, projectRows] = await Promise.all([
      this.prisma.$queryRaw<MoneyRow[]>`
        SELECT
          COALESCE(SUM((m."unitPrice" + m."materialUnitPrice") * m."specQuantity"), 0)::float AS total_budget,
          COALESCE(SUM(m."totalCost" + m."materialTotalCost"), 0)::float AS total_actual
        FROM materials m
        INNER JOIN "Project" p ON p.id = m."projectId"
        INNER JOIN "Object" o ON o.id = p."objectId"
        WHERE o."isArchived" = false
          AND EXISTS (
            SELECT 1 FROM object_access oa
            WHERE oa."objectId" = o.id
              AND oa."userId" = ${userId}
              AND oa."hidePrices" = false
              AND oa."role" <> 'VIEWER'
          )
      `,
      // ⭐ Стоимость склада: общий склад (objectId IS NULL) + свои объекты
      this.prisma.$queryRaw<WarehouseValueRow[]>`
        SELECT COALESCE(SUM(wi."quantity" * COALESCE(wi."price", 0)), 0)::float AS value
        FROM warehouse_items wi
        WHERE wi."objectId" IS NULL
          OR EXISTS (
            SELECT 1 FROM object_access oa
            WHERE oa."objectId" = wi."objectId"
              AND oa."userId" = ${userId}
              AND oa."hidePrices" = false
              AND oa."role" <> 'VIEWER'
          )
      `,
      this.budgetRows(userId),
    ]);

    const money = moneyRows[0] ?? { total_budget: 0, total_actual: 0 };
    const overrunCount = projectRows.filter((r) => r.actual > r.budget).length;
    const onTrackCount = projectRows.length - overrunCount;

    return {
      totalBudget: Math.round(money.total_budget * 100) / 100,
      totalSpent: Math.round(money.total_actual * 100) / 100,
      totalWarehouseValue: Math.round((warehouseRows[0]?.value ?? 0) * 100) / 100,
      overrunCount,
      onTrackCount,
      totalProjects: projectRows.length,
    };
  }

  // ─── 2. Бюджет vs факт по проектам (?objectId=X) ───
  async getBudgetVsActual(userId: number, objectId?: number) {
    const rows = await this.budgetRows(userId, objectId);
    return rows.map((r) => {
      const percent =
        r.budget > 0
          ? Math.round((r.actual / r.budget) * 1000) / 10
          : r.actual > 0
            ? 100
            : 0;
      const status =
        r.actual > r.budget
          ? 'over'
          : r.budget > 0 && r.actual >= r.budget * 0.9
            ? 'on-track'
            : 'under';
      return {
        projectName: r.name,
        budget: Math.round(r.budget * 100) / 100,
        actual: Math.round(r.actual * 100) / 100,
        percent,
        status,
      };
    });
  }

  // ─── 3. Динамика по месяцам (последние 6 месяцев, generate_series — без дыр) ───
  async getMonthlyTrend(userId: number) {
    const rows = await this.prisma.$queryRaw<MonthRow[]>`
      SELECT
        d.month AS month,
        COALESCE(SUM(m."totalCost" + m."materialTotalCost"), 0)::float AS spent
      FROM generate_series(
        date_trunc('month', now()) - INTERVAL '5 months',
        date_trunc('month', now()),
        INTERVAL '1 month'
      ) AS d(month)
      LEFT JOIN materials m ON date_trunc('month', m."createdAt") = d.month
        AND EXISTS (
          SELECT 1
          FROM "Project" p
          INNER JOIN "Object" o ON o.id = p."objectId" AND o."isArchived" = false
          INNER JOIN object_access oa
            ON oa."objectId" = o.id
            AND oa."userId" = ${userId}
            AND oa."hidePrices" = false
            AND oa."role" <> 'VIEWER'
          WHERE p.id = m."projectId"
        )
      GROUP BY d.month
      ORDER BY d.month
    `;
    return rows.map((r) => ({
      month: r.month.toISOString().slice(0, 7),
      spent: Math.round(r.spent * 100) / 100,
    }));
  }

  // ─── 4. Топ-5 перерасходов ───
  async getTopOverrun(userId: number) {
    const rows = await this.budgetRows(userId);
    return rows
      .filter((r) => r.actual > r.budget)
      .map((r) => ({
        projectName: r.name,
        budget: Math.round(r.budget * 100) / 100,
        actual: Math.round(r.actual * 100) / 100,
        overrun: Math.round((r.actual - r.budget) * 100) / 100,
        percent:
          r.budget > 0
            ? Math.round(((r.actual - r.budget) / r.budget) * 1000) / 10
            : 0,
      }))
      .sort((a, b) => b.overrun - a.overrun)
      .slice(0, 5);
  }
}
