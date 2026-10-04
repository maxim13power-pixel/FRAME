// backend/src/reports/reports.service.spec.ts
// ⭐ №126: unit-тесты скрытия цен в детали отчёта (Блок B).
import { ReportsService } from './reports.service';

describe('ReportsService', () => {
  const prisma = {
    report: { findUnique: jest.fn() },
    project: { findUnique: jest.fn() },
    objectAccess: { findFirst: jest.fn() },
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
    service = new ReportsService(prisma as any);
    prisma.report.findUnique.mockResolvedValue(report);
    prisma.project.findUnique.mockResolvedValue({ objectId: 2 });
    prisma.reportItem.findMany.mockResolvedValue(items);
  });

  const givenAccess = (role: string, hidePrices: boolean) => {
    prisma.objectAccess.findFirst.mockResolvedValue({ id: 1, role, hidePrices });
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
});
