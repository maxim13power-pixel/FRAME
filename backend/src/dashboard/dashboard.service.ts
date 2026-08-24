// backend/src/dashboard/dashboard.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { DashboardSummaryDto } from './dashboard.types';

// Сырые строки из $queryRaw приходят в snake_case — мапим во внутренний тип.
interface MoneyRow {
  estimate: number;
  actual: number;
  total_used: number;
  spec_quantity: number;
}
interface WeekPointRow {
  day: Date;
  count: number;
}

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  // TODO: orgId после мульти-тенантности — добавить в каждый where/aggregate.
  async getSummary(): Promise<DashboardSummaryDto> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayPlus7 = new Date(today);
    todayPlus7.setDate(todayPlus7.getDate() + 7);

    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6); // 7 дней включительно

    // ── 1. KPI + Money — одним батчем Promise.all (5 SQL, без N+1) ─────────────
    const [
      objectsCount,
      projectsCount,
      materialsCount,
      fixesLast7dCount,
      moneyRows,
    ] = await Promise.all([
      this.prisma.object.count(),
      this.prisma.project.count(),
      this.prisma.material.count(),
      this.prisma.materialFix.count({ where: { fixedAt: { gte: sevenDaysAgo } } }),
      this.prisma.$queryRaw<MoneyRow[]>`
        SELECT
          COALESCE(SUM(("unitPrice" + "materialUnitPrice") * "specQuantity"), 0)::float AS estimate,
          COALESCE(SUM("totalCost" + "materialTotalCost"), 0)::float           AS actual,
          COALESCE(SUM("totalUsed"), 0)::float                                  AS total_used,
          COALESCE(SUM("specQuantity"), 0)::float                               AS spec_quantity
        FROM materials
      `,
    ]);
    const money = moneyRows[0] ?? { estimate: 0, actual: 0, total_used: 0, spec_quantity: 0 };
    const percent = money.spec_quantity > 0 ? money.total_used / money.spec_quantity : 0;

    // ── 2. WeekChart — generate_series + LEFT JOIN material_fixes ───────────────
    const weekRows = await this.prisma.$queryRaw<WeekPointRow[]>`
      SELECT
        d::date                          AS day,
        COALESCE(COUNT(mf.id), 0)::int   AS count
      FROM generate_series(
        (${today}::timestamptz)::date - INTERVAL '6 days',
        (${today}::timestamptz)::date,
        INTERVAL '1 day'
      ) AS d
      LEFT JOIN material_fixes mf ON mf."fixedAt"::date = d
      GROUP BY d
      ORDER BY d
    `;

    // ── 3. HotProjects + NoPrice(items, count) + RecentFixes — одним батчем ────
    const [hotProjectRows, noPriceItems, noPriceCount, recentFixes] = await Promise.all([
      // 3a. Hot projects: endDate ≤ today+7, с objectId для навигации
      this.prisma.project.findMany({
        where: { endDate: { lte: todayPlus7 } },
        orderBy: { endDate: 'asc' },
        include: { object: { select: { id: true, name: true } } },
      }),
      // 3b. NoPrice — топ-5 без расценок (unitPrice=0 ИЛИ materialUnitPrice=0)
      this.prisma.material.findMany({
        where: { OR: [{ unitPrice: 0 }, { materialUnitPrice: 0 }] },
        orderBy: { updatedAt: 'desc' },
        take: 5,
        select: {
          id: true,
          name: true,
          unitPrice: true,
          materialUnitPrice: true,
          project: { select: { id: true, name: true } },
        },
      }),
      // 3c. NoPrice — total count (для бейджа)
      this.prisma.material.count({
        where: { OR: [{ unitPrice: 0 }, { materialUnitPrice: 0 }] },
      }),
      // 3d. RecentFixes — 10 последних с names material → project → object
      this.prisma.materialFix.findMany({
        orderBy: { fixedAt: 'desc' },
        take: 10,
        select: {
          id: true,
          amount: true,
          note: true,
          fixedAt: true,
          material: {
            select: {
              id: true,
              name: true,
              project: {
                select: {
                  id: true,
                  name: true,
                  object: { select: { id: true, name: true } },
                },
              },
            },
          },
        },
      }),
    ]);

    return {
      kpi: { objectsCount, projectsCount, materialsCount, fixesLast7dCount },
      money: {
        estimate: money.estimate,
        actual: money.actual,
        percent,
      },
      weekChart: weekRows.map((w) => ({
        day: w.day.toISOString().slice(0, 10),
        count: w.count,
      })),
      hotProjects: hotProjectRows.map((p) => ({
        id: p.id,
        name: p.name,
        endDate: p.endDate.toISOString(),
        objectId: p.object.id,
        objectName: p.object.name,
      })),
      noPrice: { items: noPriceItems, count: noPriceCount },
      recentFixes: recentFixes.map((f) => ({
        ...f,
        fixedAt: f.fixedAt.toISOString(), // ⭐ Date → ISO-строка по контракту DTO
      })),
    };
  }
}
