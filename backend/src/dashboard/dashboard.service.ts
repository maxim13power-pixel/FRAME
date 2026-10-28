// backend/src/dashboard/dashboard.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { DashboardSummaryDto } from './dashboard.types';
import {
  accessibleObjectWhere,
  accessibleProjectWhere,
  buildMoneyScope,
  buildWorkScope,
  loadAccessGrants,
} from '../auth/access-scope'; // ⭐ №163/№168

// Сырые строки из $queryRaw приходят в snake_case — мапим во внутренний тип.
interface MoneyRow {
  estimate: number;
  actual: number;
  total_used: number;
  spec_quantity: number;
}

// ── ⭐ №173: календарная неделя Пн→Вс ────────────────────────────────────────
// Раньше неделя считалась как «сегодня − 6 дней … сегодня», причём границы
// вычисляла БД: `(today::timestamptz)::date` в UTC давал ВЧЕРАШНЮЮ дату
// (локальные 00:00 +04 = 20:00 UTC предыдущего дня). Итог: сегодняшние
// фиксации в график не попадали вообще, а сам график начинался не с
// понедельника.
//
// Теперь дни считаются по часам ПОЛЬЗОВАТЕЛЯ: фронт присылает
// ?tzOffset=<Date#getTimezoneOffset()> (минуты, UTC − локальное).
// «Настенное» время кодируем как UTC-инстант (wall) и дальше читаем UTC-поля —
// так локальные сутки не зависят от часового пояса сервера (Railway = UTC).

/** Понедельник 00:00 недели, в которую попадает wall-дата */
function startOfWeekWall(date: Date): Date {
  const d = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); // Вс(0) → 6 дней назад
  return d;
}

function addDaysWall(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

/** YYYY-MM-DD для wall-даты (UTC-поля = локальные дни пользователя) */
function dateKeyWall(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** День (YYYY-MM-DD) реального инстанта в зоне пользователя (offset в мс) */
export function dayKeyForInstant(instant: Date, offsetMs: number): string {
  return dateKeyWall(new Date(instant.getTime() - offsetMs));
}

/** Экспорт для тестов (см. dashboard.week.spec.ts) */
export { startOfWeekWall, addDaysWall, dateKeyWall };

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  // ⭐ Новая модель доступа: показываем только объекты, к которым у юзера
  // есть запись в ObjectAccess. Архивные объекты (isArchived=true) исключаются.
  async getSummary(
    userId: number,
    tzOffsetMinutes: number = -new Date().getTimezoneOffset(),
  ): Promise<DashboardSummaryDto> {
    // ⭐ №173: смещение клиента (минуты, UTC − локальное). Без параметра — зона сервера.
    const offset = tzOffsetMinutes * 60_000;
    // «Настенное» время пользователя: сдвигаем инстант и читаем UTC-поля.
    const wallNow = new Date(Date.now() - offset);
    const wallToday = new Date(
      Date.UTC(
        wallNow.getUTCFullYear(),
        wallNow.getUTCMonth(),
        wallNow.getUTCDate(),
      ),
    );
    const today = new Date(wallToday.getTime() + offset); // локальные сутки юзера
    const todayPlus7 = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
    // ⭐ №173: «Неделя прораба» — текущая календарная неделя Пн→Вс.
    const weekStartWall = startOfWeekWall(wallToday);
    const weekStart = new Date(weekStartWall.getTime() + offset);
    const weekEnd = new Date(
      addDaysWall(weekStartWall, 7).getTime() + offset, // следующий Пн, не включая
    );

    // ⭐ №163: скоупы доступа — объектный (все проекты) и проектный (точечно).
    // ⭐ №168: отозванные доступы в KPI/деньгах не участвуют (buildWorkScope).
    const grants = await loadAccessGrants(this.prisma, userId);
    const scope = buildWorkScope(grants);
    const moneyScope = buildMoneyScope(grants);
    const accessibleProject = accessibleProjectWhere(scope);
    const moneyVisibleProject = accessibleProjectWhere(moneyScope);

    // ── 1. KPI + Money — одним батчем Promise.all (5 SQL, без N+1) ─────────────
    const [
      objectsCount,
      projectsCount,
      materialsCount,
      weekFixes,
      demoObjects,
      volumeRows,
      moneyRows,
    ] = await Promise.all([
      this.prisma.object.count({ where: accessibleObjectWhere(scope) }),
      this.prisma.project.count({ where: accessibleProject }),
      this.prisma.material.count({
        where: { project: accessibleProject },
      }),
      // ⭐ №173: фиксации текущей недели (Пн→Вс) — одна выборка и для KPI,
      // и для графика: бакеты по дням считаем ниже в JS, чтобы день определялся
      // по локальной зоне, а не по UTC базы.
      this.prisma.materialFix.findMany({
        where: {
          fixedAt: { gte: weekStart, lt: weekEnd },
          material: { project: accessibleProject },
        },
        select: { fixedAt: true },
      }),
      // ⭐ №169: демо-объекты, попавшие в расчёты (для стикера «цифры неточные»)
      this.prisma.object.count({
        where: { ...accessibleObjectWhere(scope), isDemo: true },
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
            WHERE oa."objectId" = o.id
              AND oa."userId" = ${userId}
              AND oa."revokedAt" IS NULL
              AND oa."isHidden" = false
              AND (oa."projectId" IS NULL OR oa."projectId" = p.id)
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
          -- ⭐ №203 (F12): правило денег единое — canSeeMoney() в auth/access-scope.ts
          AND EXISTS (
            SELECT 1 FROM object_access oa
            WHERE oa."objectId" = o.id
              AND oa."userId" = ${userId}
              AND oa."revokedAt" IS NULL
              AND oa."isHidden" = false
              AND oa."hidePrices" = false
              AND oa."role" <> 'VIEWER'
              AND (oa."projectId" IS NULL OR oa."projectId" = p.id)
          )
      `,
    ]);

    // ⭐ Объёмы/прогресс — по ВСЕМ доступным объектам (деньги тут не нужны)
    const volume = volumeRows[0] ?? { total_used: 0, spec_quantity: 0 };
    // ⭐ Смета/факт — только там, где юзер видит цены
    const money = moneyRows[0] ?? { estimate: 0, actual: 0 };
    const percent =
      volume.spec_quantity > 0 ? volume.total_used / volume.spec_quantity : 0;
    // ── 2. WeekChart — Пн…Вс текущей недели ────────────────────────────────────
    // ⭐ №173: границы недели и дни считаются по часам пользователя (tzOffset),
    // поэтому фиксации за сегодня попадают в правую часть графика, а не теряются
    // из-за того, что БД живёт в UTC.
    const perDay = new Map<string, number>();
    for (const fix of weekFixes) {
      const key = dayKeyForInstant(fix.fixedAt, offset);
      perDay.set(key, (perDay.get(key) ?? 0) + 1);
    }
    const weekChart = Array.from({ length: 7 }, (_, i) => {
      const key = dateKeyWall(addDaysWall(weekStartWall, i));
      return { day: key, count: perDay.get(key) ?? 0 };
    });

    // ── 3. HotProjects + NoPrice(items, count) + RecentFixes — одним батчем ────
    const [hotProjectRows, noPriceItems, noPriceCount, recentFixes] =
      await Promise.all([
        // 3a. Hot projects: endDate ≤ today+7, доступные юзеру, с объектом для навигации
        this.prisma.project.findMany({
          where: {
            endDate: { lte: todayPlus7 },
            ...accessibleProject,
          },
          orderBy: { endDate: 'asc' },
          include: { object: { select: { id: true, name: true } } },
        }),
        // 3b. NoPrice — топ-5 без расценок (только «денежно-видимые» проекты)
        this.prisma.material.findMany({
          where: {
            OR: [{ unitPrice: 0 }, { materialUnitPrice: 0 }],
            project: moneyVisibleProject,
          },
          orderBy: { updatedAt: 'desc' },
          take: 5,
          select: {
            id: true,
            name: true,
            unitPrice: true,
            materialUnitPrice: true,
            // ⭐ №161: objectId нужен фронту для deep-link «Без расценки» → строка сметы
            project: { select: { id: true, name: true, objectId: true } },
          },
        }),
        // 3c. NoPrice — total count (для бейджа)
        this.prisma.material.count({
          where: {
            OR: [{ unitPrice: 0 }, { materialUnitPrice: 0 }],
            project: moneyVisibleProject,
          },
        }),
        // 3d. RecentFixes — 10 последних с names material → project → object
        this.prisma.materialFix.findMany({
          where: { material: { project: accessibleProject } },
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
      kpi: {
        objectsCount,
        projectsCount,
        materialsCount,
        fixesWeekCount: weekFixes.length,
      },
      // ⭐ №169: сколько демо-объектов участвует в расчётах (0 = цифры точные)
      demoObjects,
      money: {
        estimate: money.estimate,
        actual: money.actual,
        percent,
      },
      weekChart,
      hotProjects: hotProjectRows.map((p) => ({
        id: p.id,
        name: p.name,
        endDate: p.endDate.toISOString(),
        objectId: p.object.id,
        objectName: p.object.name,
      })),
      noPrice: {
        items: noPriceItems.map((n) => ({
          ...n,
          // 🔒 P1-3: Decimal -> number (DTO ждёт число, JSON отдаёт строку)
          unitPrice: Number(n.unitPrice),
          materialUnitPrice: Number(n.materialUnitPrice),
        })),
        count: noPriceCount,
      },
      recentFixes: recentFixes.map((f) => ({
        ...f,
        // 🔒 P1-3: Decimal -> number по контракту DTO
        amount: Number(f.amount),
        fixedAt: f.fixedAt.toISOString(), // ⭐ Date → ISO-строка по контракту DTO
      })),
    };
  }
}
