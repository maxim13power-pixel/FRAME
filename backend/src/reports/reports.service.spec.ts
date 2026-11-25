// backend/src/reports/reports.service.spec.ts
// ⭐ №126: unit-тесты скрытия цен в детали отчёта (Блок B).
import { ForbiddenException } from '@nestjs/common';
import { ReportsService } from './reports.service';

describe('ReportsService', () => {
  const prisma = {
    report: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    project: { findUnique: jest.fn() },
    objectAccess: { findFirst: jest.fn(), findMany: jest.fn() },
    reportItem: { findMany: jest.fn() },
  };

  let service: ReportsService;

  const report = {
    id: 1,
    projectId: 1,
    objectId: 2,
    type: 'estimate',
    title: 'Смета',
    status: 'draft',
    totalAmount: 1500,
    comment: null,
    createdBy: 1,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  };

  const items = [
    {
      id: 10,
      reportId: 1,
      materialId: 5,
      name: 'Работа',
      unit: 'шт',
      quantity: 2,
      price: 100,
      total: 200,
      sortOrder: 0,
      material: { id: 5, name: 'Материал', unit: 'шт', price: 300 },
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ReportsService(prisma as any, {} as any);
    prisma.report.findUnique.mockResolvedValue(report);
    prisma.project.findUnique.mockResolvedValue({ objectId: 2 });
    prisma.reportItem.findMany.mockResolvedValue(items);
  });

  const givenAccess = (role: string, hidePrices: boolean) => {
    // ⭐ №193: checkProjectAccess читает записи одним findMany (проект + объект)
    prisma.objectAccess.findMany.mockResolvedValue([
      { id: 1, objectId: 2, projectId: 1, role, hidePrices, revokedAt: null },
    ]);
  };

  describe('detail — скрытие цен (Блок B)', () => {
    it('роль VIEWER ⇒ все денежные поля обнуляются', async () => {
      givenAccess('VIEWER', false);

      const result: any = await service.detail(7, 1);

      expect(result.totalAmount).toBe(0);
      expect(result.items[0].price).toBe(0);
      expect(result.items[0].total).toBe(0);
      expect(result.items[0].material.price).toBe(0);
    });

    it('hidePrices=true ⇒ все денежные поля обнуляются', async () => {
      givenAccess('FOREMAN', true);

      const result: any = await service.detail(7, 1);

      expect(result.totalAmount).toBe(0);
      expect(result.items[0].price).toBe(0);
      expect(result.items[0].total).toBe(0);
      expect(result.items[0].material.price).toBe(0);
    });

    it('FOREMAN + hidePrices=false ⇒ цены остаются', async () => {
      givenAccess('FOREMAN', false);

      const result: any = await service.detail(7, 1);

      expect(result.totalAmount).toBe(1500);
      expect(result.items[0].price).toBe(100);
      expect(result.items[0].total).toBe(200);
      expect(result.items[0].material.price).toBe(300);
    });
  });

  // ⭐ №180: в списке отчётов суммы игнорировали hidePrices/VIEWER.
  describe('№180: список отчётов уважает hidePrices', () => {
    const grant = (hidePrices: boolean) => ({
      objectId: 2,
      projectId: null as number | null,
      role: 'FOREMAN',
      hidePrices,
      revokedAt: null as Date | null,
    });

    it('hidePrices=true ⇒ totalAmount в списке обнуляется', async () => {
      prisma.objectAccess.findMany.mockResolvedValue([grant(true)]);
      prisma.report.findMany.mockResolvedValue([report]);

      const result: any = await service.list(7, {});

      expect(result[0].totalAmount).toBe(0);
    });

    it('hidePrices=false ⇒ суммы остаются', async () => {
      prisma.objectAccess.findMany.mockResolvedValue([grant(false)]);
      prisma.report.findMany.mockResolvedValue([report]);

      const result: any = await service.list(7, {});

      expect(result[0].totalAmount).toBe(1500);
    });

    it('VIEWER не может удалить отчёт ⇒ ForbiddenException', async () => {
      givenAccess('VIEWER', false);

      await expect(service.remove(7, 1)).rejects.toThrow(ForbiddenException);
      expect(prisma.report.delete).not.toHaveBeenCalled();
    });
  });

  // ⭐ №391: журнал отчётов растёт без ограничений — включаем keyset по запросу.
  describe('№391: keyset-пагинация списка', () => {
    const at = (day: number) => new Date(`2026-01-0${day}T10:00:00Z`);
    const r = (id: number, day: number) => ({
      ...report,
      id,
      updatedAt: at(day),
    });

    beforeEach(() => {
      prisma.objectAccess.findMany.mockResolvedValue([]); // без выданных доступов
    });

    it('без ?limit= — прежний массив, total не считается', async () => {
      prisma.report.findMany.mockResolvedValue([report]);

      const result: any = await service.list(7, {});

      expect(Array.isArray(result)).toBe(true);
      expect(result[0].id).toBe(1);
      expect(prisma.report.count).not.toHaveBeenCalled();
      expect(prisma.report.findMany.mock.calls[0][0].take).toBeUndefined();
    });

    it('?limit=2 — конверт {items,total,nextCursor}, запрос берёт limit+1', async () => {
      prisma.report.findMany.mockResolvedValue([r(3, 3), r(2, 2), r(1, 1)]);
      prisma.report.count.mockResolvedValue(5);

      const result: any = await service.list(7, {}, { limit: '2' });

      expect(result.items.map((x: any) => x.id)).toEqual([3, 2]);
      expect(result.total).toBe(5);
      expect(typeof result.nextCursor).toBe('string');

      const args = prisma.report.findMany.mock.calls[0][0];
      expect(args.take).toBe(3);
      expect(args.orderBy).toEqual([{ updatedAt: 'desc' }, { id: 'desc' }]);
      // первая страница: фильтр курсора не добавляется
      expect(args.where.AND).toHaveLength(1);
    });

    it('ровно limit записей — следующей страницы нет', async () => {
      prisma.report.findMany.mockResolvedValue([r(2, 2), r(1, 1)]);
      prisma.report.count.mockResolvedValue(2);

      const result: any = await service.list(7, {}, { limit: '2' });

      expect(result.items).toHaveLength(2);
      expect(result.nextCursor).toBeNull();
    });

    it('курсор первой страницы читается второй страницей без дублей', async () => {
      prisma.report.findMany.mockResolvedValueOnce([r(3, 3), r(2, 2), r(1, 1)]);
      prisma.report.count.mockResolvedValue(3);
      const first: any = await service.list(7, {}, { limit: '2' });

      prisma.report.findMany.mockResolvedValueOnce([r(1, 1)]);
      const second: any = await service.list(7, {}, {
        limit: '2',
        cursor: first.nextCursor,
      });

      const cursorWhere = prisma.report.findMany.mock.calls[1][0].where.AND[1];
      expect(cursorWhere).toEqual({
        OR: [
          { updatedAt: { lt: at(2) } },
          { updatedAt: at(2), id: { lt: 2 } },
        ],
      });
      expect(second.items.map((x: any) => x.id)).toEqual([1]);
      expect(second.nextCursor).toBeNull();
      const ids = [...first.items, ...second.items].map((x: any) => x.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('суммы по-прежнему скрываются и в странице', async () => {
      prisma.objectAccess.findMany.mockResolvedValue([
        { objectId: 2, projectId: null, role: 'FOREMAN', hidePrices: true, revokedAt: null },
      ]);
      prisma.report.findMany.mockResolvedValue([r(3, 3), r(2, 2)]);
      prisma.report.count.mockResolvedValue(2);

      const result: any = await service.list(7, {}, { limit: '1' });

      expect(result.items[0].totalAmount).toBe(0);
    });

    it('мусорный курсор — 400, а не тихая первая страница', async () => {
      await expect(
        service.list(7, {}, { limit: '2', cursor: 'abc' }),
      ).rejects.toThrow('cursor: неверный формат');
      expect(prisma.report.findMany).not.toHaveBeenCalled();
    });
  });
});
