// backend/src/analytics/analytics.service.spec.ts
// ⭐ №226 (§72): регрессии по отчёту аудита —
// P2-1 (перепутанные demoObjects / warehouseItemsWithoutPrice), P2-2 (проект без строк),
// P3-5 (смета 0 → percent null / статус no-budget), P3-8 (чужой объект → 404),
// P3-4 (месяцы по фиксациям и в зоне пользователя).
import { NotFoundException } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';

const createPrisma = () => ({
  $queryRaw: jest.fn(),
  user: { findUnique: jest.fn() },
  objectAccess: { findFirst: jest.fn(), findMany: jest.fn() },
});

describe('AnalyticsService', () => {
  let prisma: ReturnType<typeof createPrisma>;
  let service: AnalyticsService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma = createPrisma();
    prisma.user.findUnique.mockResolvedValue({ role: 'FOREMAN' });
    service = new AnalyticsService(prisma as any);
  });

  describe('getSummary — P2-1: demoObjects и warehouseItemsWithoutPrice', () => {
    it('не перепутаны: демо-объектов нет, позиция без цены одна', async () => {
      prisma.$queryRaw
        .mockResolvedValueOnce([{ total_budget: 6000, total_actual: 7200 }]) // деньги
        .mockResolvedValueOnce([{ value: 350 }]) // склад
        .mockResolvedValueOnce([
          { project_id: 1, name: 'A', budget: 1000, actual: 1200 },
          { project_id: 2, name: 'B', budget: 0, actual: 500 },
          { project_id: 3, name: 'C', budget: 0, actual: 0 },
          { project_id: 4, name: 'D', budget: 1000, actual: 500 },
        ]) // проекты
        .mockResolvedValueOnce([{ cnt: 1 }]) // склад БЕЗ цены
        .mockResolvedValueOnce([{ cnt: 0 }]); // демо-объекты

      const res = await service.getSummary(7);

      expect(res.demoObjects).toBe(0);
      expect(res.warehouseItemsWithoutPrice).toBe(1);
      expect(res.totalWarehouseValue).toBe(350);
    });

    it('обратный случай: два демо-объекта и ноль позиций без цены', async () => {
      prisma.$queryRaw
        .mockResolvedValueOnce([{ total_budget: 0, total_actual: 0 }])
        .mockResolvedValueOnce([{ value: 0 }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ cnt: 0 }])
        .mockResolvedValueOnce([{ cnt: 2 }]);

      const res = await service.getSummary(7);

      expect(res.demoObjects).toBe(2);
      expect(res.warehouseItemsWithoutPrice).toBe(0);
    });

    it('P2-2/P3-5: проект без строк и проект без сметы не считаются перерасходом', async () => {
      prisma.$queryRaw
        .mockResolvedValueOnce([{ total_budget: 3000, total_actual: 2200 }])
        .mockResolvedValueOnce([{ value: 0 }])
        .mockResolvedValueOnce([
          { project_id: 1, name: 'over', budget: 1000, actual: 1200 },
          { project_id: 2, name: 'under', budget: 1000, actual: 500 },
          { project_id: 3, name: 'zero', budget: 0, actual: 500 },
          { project_id: 4, name: 'empty', budget: 0, actual: 0 },
        ])
        .mockResolvedValueOnce([{ cnt: 0 }])
        .mockResolvedValueOnce([{ cnt: 0 }]);

      const res = await service.getSummary(7);

      expect(res.totalProjects).toBe(4);
      expect(res.overrunCount).toBe(1);
      expect(res.noBudgetCount).toBe(2);
      expect(res.onTrackCount).toBe(1);
    });
  });

  describe('getBudgetVsActual — P3-5 и P3-8', () => {
    it('смета 0 → percent null и статус no-budget, без Infinity/NaN', async () => {
      prisma.objectAccess.findFirst.mockResolvedValue({ id: 1 });
      prisma.$queryRaw.mockResolvedValueOnce([
        { project_id: 1, name: 'A', budget: 1000, actual: 1200 },
        { project_id: 2, name: 'B', budget: 0, actual: 500 },
        { project_id: 3, name: 'C', budget: 0, actual: 0 },
        { project_id: 4, name: 'D', budget: 1000, actual: 950 },
      ]);

      const res = await service.getBudgetVsActual(7, 42);

      expect(res[0]).toEqual({
        projectName: 'A', budget: 1000, actual: 1200, percent: 120, status: 'over',
      });
      expect(res[1].percent).toBeNull();
      expect(res[1].status).toBe('no-budget');
      expect(res[2].status).toBe('no-budget');
      expect(res[3].status).toBe('on-track');
      expect(res.every((r) => r.percent === null || Number.isFinite(r.percent))).toBe(true);
    });

    it('чужой объект → 404 и ни одного запроса данных', async () => {
      prisma.objectAccess.findFirst.mockResolvedValue(null);

      await expect(service.getBudgetVsActual(7, 42)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.$queryRaw).not.toHaveBeenCalled();
    });
  });

  describe('getTopOverrun — P3-5: сортировка, срез и смета 0', () => {
    it('топ-5 по абсолютному перерасходу, без сметы — percent null', async () => {
      prisma.$queryRaw.mockResolvedValueOnce([
        { project_id: 1, name: 'big', budget: 1000, actual: 2000 },
        { project_id: 2, name: 'zero', budget: 0, actual: 500 },
        { project_id: 3, name: 'a', budget: 1000, actual: 1100 },
        { project_id: 4, name: 'b', budget: 1000, actual: 1050 },
        { project_id: 5, name: 'c', budget: 1000, actual: 1030 },
        { project_id: 6, name: 'd', budget: 1000, actual: 1020 },
        { project_id: 7, name: 'e', budget: 1000, actual: 1010 },
        { project_id: 8, name: 'eco', budget: 1000, actual: 500 },
      ]);

      const res = await service.getTopOverrun(7);

      expect(res).toHaveLength(5);
      expect(res.map((r) => r.projectName)).toEqual(['big', 'zero', 'a', 'b', 'c']);
      expect(res.map((r) => r.overrun)).toEqual([1000, 500, 100, 50, 30]);
      expect(res[1].percent).toBeNull();
      expect(res[0].percent).toBe(100);
      expect(res.every((r) => Number.isFinite(r.overrun))).toBe(true);
    });
  });

  describe('getMonthlyTrend — P3-4: фиксации и зона пользователя', () => {
    it('6 месяцев по порядку, пустые — нули, границы окна в зоне +04', async () => {
      prisma.$queryRaw.mockResolvedValueOnce([{ month: '2026-11', spent: 333 }]);

      const res = await service.getMonthlyTrend(
        7,
        -240,
        new Date('2026-11-08T12:00:00.000Z'),
      );

      expect(res.map((r) => r.month)).toEqual([
        '2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11',
      ]);
      expect(res[0].spent).toBe(0);
      expect(res[5]).toEqual({ month: '2026-11', spent: 333 });

      // границы окна: 01.06 00:00 +04 = 31.05 20:00 UTC … 01.12 00:00 +04 = 30.11 20:00 UTC
      const params = prisma.$queryRaw.mock.calls[0].slice(1) as unknown[];
      const dates = params.filter((p): p is Date => p instanceof Date);
      expect(dates.map((d) => d.toISOString())).toEqual([
        '2026-05-31T20:00:00.000Z',
        '2026-11-30T20:00:00.000Z',
      ]);
    });
  });
});
