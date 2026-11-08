// backend/src/analytics/analytics.service.ts
// ⭐ Срез 3: аналитика освоения бюджета.
// «Бюджет» (план) = Σ (unitPrice + materialUnitPrice) × specQuantity по материалам проекта,
// «Факт» = Σ (totalCost + materialTotalCost) — как в dashboard.service (поля budget нет в схеме).
// Деньги считаем только по объектам, где юзер ВИДИТ цены (hidePrices=false, role ≠ VIEWER).
//
// ⭐ №226 (§72): правки по отчёту аудита —
//   1) demoObjects и warehouseItemsWithoutPrice больше не перепутаны;
//   2) проект без строк сметы не выпадает (LEFT JOIN) — totalProjects сходится с дашбордом;
//   3) склад: у глобального ADMIN то же правило, что в /warehouse/items (все общие позиции);
//   4) monthly-trend — по ДАТАМ ФИКСАЦИЙ и в зоне пользователя (tzOffset), а не по createdAt в UTC;
//   5) budget = 0 → percent = null и статус 'no-budget' (никаких 100 % и «0 %»);
//   6) чужой objectId → 404 (как в остальных API), мусор в objectId → 400.
import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { lastMonthKeys, monthStartInstant, nextMonthKey } from './analytics.months';

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
  month: string;
  spent: number;
}

/** Статус проекта в «бюджет vs факт»: нет сметы — отдельное состояние, а не «перерасход 100 %». */
export type BudgetStatus = 'over' | 'on-track' | 'under' | 'no-budget';

const round2 = (value: number) => Math.round(value * 100) / 100;
const round1 = (value: number) => Math.round(value * 10) / 10;

/** Правило денег одно на весь проект — как canSeeMoney() в auth/access-scope.ts. */
const moneyGrantSql = (userId: number) => Prisma.sql`
  EXISTS (
    SELECT 1 FROM object_access oa
    WHERE oa."objectId" = o.id
      AND oa."userId" = ${userId}
      AND oa."revokedAt" IS NULL
      AND oa."isHidden" = false
      AND oa."hidePrices" = false
      AND oa."role" <> 'VIEWER'
      AND (oa."projectId" IS NULL OR oa."projectId" = p.id)
  )
`;

/** То же правило для складской позиции (привязка к объекту, без projectId). */
const warehouseMoneyGrantSql = (userId: number) => Prisma.sql`
  EXISTS (
    SELECT 1 FROM object_access oa
    WHERE oa."objectId" = wi."objectId"
      AND oa."userId" = ${userId}
      AND oa."revokedAt" IS NULL
      AND oa."isHidden" = false
      AND oa."hidePrices" = false
      AND oa."role" <> 'VIEWER'
  )
`;

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  // ⭐ №204/№226: глобальный ADMIN видит все «общие» позиции склада — как в warehouse.service.list
  private async isAdmin(userId: number): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    return user?.role === 'ADMIN';
  }

  /** Правило «общих» (objectId IS NULL) позиций склада — ровно как generalItemsWhere(). */
  private generalWarehouseSql(admin: boolean, userId: number): Prisma.Sql {
    if (admin) return Prisma.sql`wi."objectId" IS NULL`;
    return Prisma.sql`(
      wi."objectId" IS NULL
      AND (wi."createdBy" IS NULL OR wi."createdBy" = ${userId})
    )`;
  }

  /** ⭐ №226 (§72, P3-8): чужой объект → 404, а не пустой список (не раскрываем существование). */
  private async assertObjectVisible(userId: number, objectId: number): Promise<void> {
    const grant = await this.prisma.objectAccess.findFirst({
      where: { userId, objectId, revokedAt: null, isHidden: false },
      select: { id: true },
    });
    if (!grant) throw new NotFoundException('Объект не найден');
  }

  // ─── Общий запрос «бюджет/факт по проектам» (опциональный фильтр по объекту) ───
  // ⭐ №226: LEFT JOIN — проект без строк сметы больше не выпадает из totalProjects
  // и из budget-vs-actual (у него budget = 0, actual = 0, статус 'no-budget').
  private budgetRows(userId: number, objectId?: number): Promise<BudgetRow[]> {
    const objectFilter = objectId != null ? Prisma.sql`AND o.id = ${objectId}` : Prisma.empty;
    return this.prisma.$queryRaw<BudgetRow[]>`
      SELECT
        p.id AS project_id,
        p.name AS name,
        COALESCE(SUM((m."unitPrice" + m."materialUnitPrice") * m."specQuantity"), 0)::float AS budget,
        COALESCE(SUM(m."totalCost" + m."materialTotalCost"), 0)::float AS actual
      FROM "Project" p
      INNER JOIN "Object" o ON o.id = p."objectId"
      LEFT JOIN materials m ON m."projectId" = p.id
      WHERE o."isArchived" = false
        AND ${moneyGrantSql(userId)}
        ${objectFilter}
      GROUP BY p.id, p.name
      ORDER BY actual DESC, p.name ASC
    `;
  }

  // ─── 1. Сводка: бюджеты/факт/склад/перерасходы ───
  async getSummary(userId: number) {
    const admin = await this.isAdmin(userId);
    const generalWarehouse = this.generalWarehouseSql(admin, userId);
    // ⭐ №226 (§72, P2-1): порядок переменных = порядок запросов. Раньше 4-й и 5-й были
    // перепутаны: demoObjects показывал складские позиции без цены, а
    // warehouseItemsWithoutPrice — демо-объекты.
    const [moneyRows, warehouseRows, projectRows, noPriceRows, demoRows] =
      await Promise.all([
        this.prisma.$queryRaw<MoneyRow[]>`
          SELECT
            COALESCE(SUM((m."unitPrice" + m."materialUnitPrice") * m."specQuantity"), 0)::float AS total_budget,
            COALESCE(SUM(m."totalCost" + m."materialTotalCost"), 0)::float AS total_actual
          FROM materials m
          INNER JOIN "Project" p ON p.id = m."projectId"
          INNER JOIN "Object" o ON o.id = p."objectId"
          WHERE o."isArchived" = false
            AND ${moneyGrantSql(userId)}
        `,
        // Стоимость склада: «общие» позиции (у ADMIN — все, у остальных свои/легаси) + свои объекты
        this.prisma.$queryRaw<WarehouseValueRow[]>`
          SELECT COALESCE(SUM(wi."quantity" * COALESCE(wi."price", 0)), 0)::float AS value
          FROM warehouse_items wi
          WHERE (${generalWarehouse})
            OR ${warehouseMoneyGrantSql(userId)}
        `,
        this.budgetRows(userId),
        // Позиции склада БЕЗ цены — их стоимость не входит в totalWarehouseValue
        this.prisma.$queryRaw<{ cnt: number }[]>`
          SELECT COUNT(*)::int AS cnt
          FROM warehouse_items wi
          WHERE wi."price" IS NULL
            AND ((${generalWarehouse}) OR ${warehouseMoneyGrantSql(userId)})
        `,
        // Демо-объекты в расчётах (стикер «цифры неточные»)
        this.prisma.$queryRaw<{ cnt: number }[]>`
          SELECT COUNT(DISTINCT o.id)::int AS cnt
          FROM "Object" o
          WHERE o."isDemo" = true
            AND o."isArchived" = false
            AND EXISTS (
              SELECT 1 FROM object_access oa
              WHERE oa."objectId" = o.id
                AND oa."userId" = ${userId}
                AND oa."revokedAt" IS NULL
                AND oa."isHidden" = false
            )
        `,
      ]);

    const money = moneyRows[0] ?? { total_budget: 0, total_actual: 0 };
    // ⭐ №226 (§72, P3-5): «перерасход» — только там, где смета вообще есть.
    // Проекты без сметы (budget = 0) считаем отдельно, чтобы не выдавать «100 %».
    const overrunCount = projectRows.filter(
      (r) => r.budget > 0 && r.actual > r.budget,
    ).length;
    const noBudgetCount = projectRows.filter((r) => r.budget <= 0).length;
    const onTrackCount = projectRows.length - overrunCount - noBudgetCount;

    return {
      totalBudget: round2(money.total_budget),
      totalSpent: round2(money.total_actual),
      totalWarehouseValue: round2(warehouseRows[0]?.value ?? 0),
      warehouseItemsWithoutPrice: noPriceRows[0]?.cnt ?? 0,
      overrunCount,
      // ⭐ №226: проекты без сметы — отдельная цифра (раньше попадали в «перерасход»)
      noBudgetCount,
      onTrackCount,
      totalProjects: projectRows.length,
      demoObjects: demoRows[0]?.cnt ?? 0,
    };
  }

  // ─── 2. Бюджет vs факт по проектам (?objectId=X) ───
  async getBudgetVsActual(userId: number, objectId?: number) {
    // ⭐ №226 (§72, P3-8): чужой объект — 404, как в остальных API
    if (objectId != null) await this.assertObjectVisible(userId, objectId);
    const rows = await this.budgetRows(userId, objectId);
    return rows.map((r) => {
      const budget = round2(r.budget);
      const actual = round2(r.actual);
      // ⭐ №226 (§72, P3-5): смета = 0 → процента НЕТ (раньше подставлялось 100)
      const percent = budget > 0 ? round1((actual / budget) * 100) : null;
      const status: BudgetStatus =
        budget <= 0
          ? 'no-budget'
          : actual > budget
            ? 'over'
            : actual >= budget * 0.9
              ? 'on-track'
              : 'under';
      return { projectName: r.name, budget, actual, percent, status };
    });
  }

  // ─── 3. Динамика по месяцам (6 месяцев, без дыр) ───
  // ⭐ №226 (§72, P3-4): источник — ДАТЫ ФИКСАЦИЙ (material_fixes.fixedAt), а не createdAt
  // строки сметы; бакеты — в зоне пользователя (tzOffset, как в дашборде №173).
  async getMonthlyTrend(
    userId: number,
    tzOffsetMinutes?: number,
    now: Date = new Date(),
  ) {
    const tz = tzOffsetMinutes ?? -new Date().getTimezoneOffset();
    const keys = lastMonthKeys(now, tz, 6);
    const start = monthStartInstant(keys[0], tz);
    const end = monthStartInstant(nextMonthKey(keys[keys.length - 1]), tz);
    const rows = await this.prisma.$queryRaw<MonthRow[]>`
      SELECT
        to_char(
          date_trunc(
            'month',
            ((f."fixedAt" - make_interval(mins => ${tz}::int)) AT TIME ZONE 'UTC')
          ),
          'YYYY-MM'
        ) AS month,
        COALESCE(SUM(f.amount * (m."unitPrice" + m."materialUnitPrice")), 0)::float AS spent
      FROM material_fixes f
      INNER JOIN materials m ON m.id = f."materialId"
      INNER JOIN "Project" p ON p.id = m."projectId"
      INNER JOIN "Object" o ON o.id = p."objectId"
      WHERE o."isArchived" = false
        AND f."fixedAt" >= ${start}
        AND f."fixedAt" < ${end}
        AND ${moneyGrantSql(userId)}
      GROUP BY 1
      ORDER BY 1
    `;
    const spentByMonth = new Map(rows.map((r) => [r.month, r.spent]));
    return keys.map((month) => ({
      month,
      spent: round2(spentByMonth.get(month) ?? 0),
    }));
  }

  // ─── 4. Топ-5 перерасходов ───
  async getTopOverrun(userId: number) {
    const rows = await this.budgetRows(userId);
    return rows
      .filter((r) => r.actual > r.budget)
      .map((r) => {
        const budget = round2(r.budget);
        const actual = round2(r.actual);
        return {
          projectName: r.name,
          budget,
          actual,
          overrun: round2(actual - budget),
          // ⭐ №226 (§72, P3-5): без сметы процента нет — в UI покажем «—», а не «0 %»
          percent: budget > 0 ? round1(((actual - budget) / budget) * 100) : null,
        };
      })
      .sort(
        (a, b) =>
          b.overrun - a.overrun || a.projectName.localeCompare(b.projectName, 'ru'),
      )
      .slice(0, 5);
  }
}
