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

  // ⭐ Новая модель доступа: показываем только объекты, к которым у юзера
  // есть запись в ObjectAccess. Архивные объекты (isArchived=true) исключаются.
  async getSummary(userId: number): Promise<DashboardSummaryDto> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayPlus7 = new Date(today);
    todayPlus7.setDate(todayPlus7.getDate() + 7);
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6); // 7 дней включительно

    // ⭐ Единый фильтр «объект доступен юзеру и не в архиве» (для вложенных where)
    const accessibleObject = {
      accesses: { some: { userId } },
      isArchived: false,
    };
    // ⭐ Фильтр для ДЕНЕЖНЫХ данных: исключаем объекты, где у юзера скрыты цены
    //    (флаг hidePrices или роль VIEWER — они видят объёмы, но не деньги)
    const moneyVisibleObject = {
      accesses: { some: { userId, hidePrices: false, role: { not: 'VIEWER' as const } } },
      isArchived: false,
    };

    // ── 1. KPI + Money — одним батчем Promise.all (5 SQL, без N+1) ─────────────
    const [
      objectsCount,
      projectsCount,
      materialsCount,
      fixesLast7dCount,
      volumeRows,
      moneyRows,
    ] = await Promise.all([
      this.prisma.object.count({ where: accessibleObject }),
      this.prisma.project.count({
        where: { object: accessibleObject },
      }),
      this.prisma.material.count({
        where: { project: { object: accessibleObject } },
      }),
      this.prisma.materialFix.count({
        where: {
          fixedAt: { gte: sevenDaysAgo },
          material: { project: { object: accessibleObject } },
        },
      }),
      // ⭐ EXISTS по object_access вместо o."orgId" = ...: не двоирует суммы,
      //    даже если у юзера несколько записей доступа на один объект.
      this.prisma.$queryRaw<MoneyRow[]>`
        SELECT
          COALESCE(SUM((m."unitPrice" + m."materialUnitPrice") * m."specQuantity"), 0)::float AS estimate,
          COALESCE(SUM(m."totalCost" + m."materialTotalCost"), 0)::float           AS actual,
          COALESCE(SUM(m."totalUsed"), 0)::float                                  AS total_used,
          COALESCE(SUM(m."specQuantity"), 0)::float                               AS spec_quantity
        FROM materials m
        INNER JOIN "Project" p ON p.id = m."projectId"
        INNER JOIN "Object" o ON o.id = p."objectId"
        WHERE o."isArchived" = false
          AND EXISTS (
            SELECT 1 FROM object_access oa
            WHERE oa."objectId" = o.id AND oa."userId" = ${userId}
          )
      `,
      // ⭐ Деньги (смета/факт) — только по объектам, где юзер ВИДИТ цены
      //    (исключаем флаг hidePrices и роль VIEWER)
      this.prisma.$queryRaw<MoneyRow[]>`
        SELECT
          COALESCE(SUM((m."unitPrice" + m."materialUnitPrice") * m."specQuantity"), 0)::float AS estimate,
          COALESCE(SUM(m."totalCost" + m."materialTotalCost"), 0)::float           AS actual,
          0::float                                                                 AS total_used,
          0::float                                                                 AS spec_quantity
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
    ]);

    // ⭐ Объёмы/прогресс — по ВСЕМ доступным объектам (деньги тут не нужны)
    const volume = volumeRows[0] ?? { total_used: 0, spec_quantity: 0 };
    // ⭐ Смета/факт — только там, где юзер видит цены
    const money = moneyRows[0] ?? { estimate: 0, actual: 0 };
    const percent = volume.spec_quantity > 0 ? volume.total_used / volume.spec_quantity : 0;
    // ── 2. WeekChart — generate_series + LEFT JOIN material_fixes ───────────────
    // ⭐ Фиксации считаем только по доступным юзеру (и не архивным) объектам — через EXISTS.
    const weekRows = await this.prisma.$queryRaw<WeekPointRow[]>`
      SELECT
        d::date                          AS day,
        COALESCE(COUNT(mf.id), 0)::int   AS count
      FROM generate_series(
        (${today}::timestamptz)::date - INTERVAL '6 days',
        (${today}::timestamptz)::date,
        INTERVAL '1 day'
      ) AS d
      LEFT JOIN material_fixes mf
        ON mf."fixedAt"::date = d
        AND EXISTS (
          SELECT 1
          FROM materials m
          INNER JOIN "Project" p ON p.id = m."projectId"
          INNER JOIN "Object" o ON o.id = p."objectId" AND o."isArchived" = false
          INNER JOIN object_access oa ON oa."objectId" = o.id AND oa."userId" = ${userId}
          WHERE m.id = mf."materialId"
        )
      GROUP BY d
      ORDER BY d
    `;

    // ── 3. HotProjects + NoPrice(items, count) + RecentFixes — одним батчем ────
    const [hotProjectRows, noPriceItems, noPriceCount, recentFixes] = await Promise.all([
      // 3a. Hot projects: endDate ≤ today+7, доступные юзеру, с объектом для навигации
      this.prisma.project.findMany({
        where: {
          endDate: { lte: todayPlus7 },
          object: accessibleObject,
        },
        orderBy: { endDate: 'asc' },
        include: { object: { select: { id: true, name: true } } },
      }),
   // 3b. NoPrice — топ-5 без расценок (только «денежно-видимые» объекты)
   this.prisma.material.findMany({
     where: {
       OR: [{ unitPrice: 0 }, { materialUnitPrice: 0 }],
       project: { object: moneyVisibleObject },
     },
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
        where: {
          OR: [{ unitPrice: 0 }, { materialUnitPrice: 0 }],
          project: { object: moneyVisibleObject },
        },
      }),
      // 3d. RecentFixes — 10 последних с names material → project → object
      this.prisma.materialFix.findMany({
        where: { material: { project: { object: accessibleObject } } },
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