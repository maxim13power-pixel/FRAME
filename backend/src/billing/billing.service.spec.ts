// backend/src/billing/billing.service.spec.ts
// ⭐ №404: тарифы и счётчики (этап 0). Enforcement не проверяем — его включает этап 1.
import { BillingService, periodKey } from './billing.service';

const plan = (over: Record<string, unknown> = {}) => ({
  code: 'FREE',
  name: 'Старт',
  priceMonthly: 0,
  maxObjects: 1,
  maxRows: 150,
  maxPhotos: 5,
  maxStorageMb: null,
  maxPdfPerMonth: 3,
  maxExportRows: 150,
  maxWriters: 0,
  maxViewers: 1,
  historyMonths: 3,
  isPublic: true,
  sortOrder: 1,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...over,
});

const sub = (over: Record<string, unknown> = {}) => ({
  id: 1,
  userId: 7,
  planCode: 'FOREMAN',
  status: 'ACTIVE',
  source: 'PAYMENT',
  periodEnd: null,
  grandfather: false,
  pdfUsed: 0,
  pdfPeriod: null,
  seatsPaid: 0,
  storageAddonMb: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...over,
});

const makeService = (prisma: Record<string, any>) => new BillingService(prisma as any);

describe('BillingService (этап 0)', () => {
  describe('periodKey', () => {
    it('возвращает YYYY-MM в МСК', () => {
      // 2026-11-30T22:30Z = 01.12 01:30 МСК → уже декабрь
      expect(periodKey(new Date('2026-11-30T22:30:00Z'))).toBe('2026-12');
      expect(periodKey(new Date('2026-11-30T20:30:00Z'))).toBe('2026-11');
    });
  });

  describe('resolvePlanCode', () => {
    const service = makeService({});

    it('без подписки — Free', () => {
      expect(service.resolvePlanCode(null)).toBe('FREE');
    });

    it('grandfather — платный план навсегда, срок не важен', () => {
      expect(
        service.resolvePlanCode(
          sub({ grandfather: true, planCode: 'TEAM', periodEnd: new Date('2020-01-01') }) as any,
        ),
      ).toBe('TEAM');
    });

    it('истёк период — Free, данные не трогаем', () => {
      expect(
        service.resolvePlanCode(sub({ periodEnd: new Date('2026-01-01') }) as any, new Date('2026-11-26')),
      ).toBe('FREE');
    });

    it('активная подписка — её план', () => {
      expect(
        service.resolvePlanCode(sub({ periodEnd: new Date('2027-01-01') }) as any, new Date('2026-11-26')),
      ).toBe('FOREMAN');
    });

    it('отменённая подписка — Free', () => {
      expect(service.resolvePlanCode(sub({ status: 'CANCELED' }) as any)).toBe('FREE');
    });
  });

  describe('pdfUsed', () => {
    const service = makeService({});

    it('счётчик другого месяца читается как 0 (ленивый сброс)', () => {
      const now = new Date('2026-11-26T10:00:00Z');
      expect(service.pdfUsed(sub({ pdfUsed: 9, pdfPeriod: '2026-10' }) as any, now)).toBe(0);
      expect(service.pdfUsed(sub({ pdfUsed: 9, pdfPeriod: periodKey(now) }) as any, now)).toBe(9);
    });

    it('без подписки — 0', () => {
      expect(service.pdfUsed(null)).toBe(0);
    });
  });

  describe('getUsage', () => {
    it('считает объекты, строки, фото, участников — по объектам, где пользователь CUSTOMER', async () => {
      const prisma = {
        objectAccess: {
          findMany: jest
            .fn()
            // 1-й вызов: объекты, где я админ
            .mockResolvedValueOnce([{ objectId: 10 }, { objectId: 10 }, { objectId: 11 }])
            // 2-й вызов: участники этих объектов
            .mockResolvedValueOnce([
              { userId: 7, role: 'CUSTOMER' },
              { userId: 8, role: 'FOREMAN' },
              { userId: 8, role: 'FOREMAN' },
              { userId: 9, role: 'VIEWER' },
            ]),
        },
        material: { count: jest.fn().mockResolvedValue(120) },
        materialPhoto: {
          aggregate: jest.fn().mockResolvedValue({ _count: { _all: 4 }, _sum: { sizeBytes: 4 * 1024 * 1024 } }),
        },
      };
      const service = makeService(prisma);

      const usage = await service.getUsage(7, sub({ pdfUsed: 2, pdfPeriod: periodKey() }) as any);

      expect(usage.objects).toBe(2);
      expect(usage.rows).toBe(120);
      expect(usage.photos).toBe(4);
      expect(usage.storageMb).toBe(4);
      expect(usage.writers).toBe(1); // прораб 8 (дубль схлопнут)
      expect(usage.viewers).toBe(1); // наблюдатель 9
      expect(usage.pdfUsed).toBe(2);
      expect(prisma.material.count).toHaveBeenCalledWith({
        where: { project: { objectId: { in: [10, 11] } } },
      });
    });

    it('без объектов не ходит в БД за строками и фото', async () => {
      const prisma = {
        objectAccess: { findMany: jest.fn().mockResolvedValue([]) },
        material: { count: jest.fn() },
        materialPhoto: { aggregate: jest.fn() },
      };
      const service = makeService(prisma);

      const usage = await service.getUsage(42, null);

      expect(usage).toEqual({ objects: 0, rows: 0, photos: 0, storageMb: 0, writers: 0, viewers: 0, pdfUsed: 0 });
      expect(prisma.material.count).not.toHaveBeenCalled();
      expect(prisma.materialPhoto.aggregate).not.toHaveBeenCalled();
    });
  });

  describe('getSnapshot', () => {
    it('считает остатки по лимитам и берёт план из БД', async () => {
      const prisma = {
        subscription: { findUnique: jest.fn().mockResolvedValue(sub({ pdfUsed: 1, pdfPeriod: periodKey() })) },
        plan: {
          findUnique: jest.fn().mockResolvedValue(
            plan({
              code: 'FOREMAN',
              maxObjects: 5,
              maxRows: 5000,
              maxPhotos: null,
              maxStorageMb: 3072,
              maxPdfPerMonth: 200,
              maxWriters: 3,
              maxViewers: 5,
            }),
          ),
        },
        objectAccess: {
          findMany: jest
            .fn()
            .mockResolvedValueOnce([{ objectId: 1 }, { objectId: 2 }])
            .mockResolvedValueOnce([
              { userId: 8, role: 'FOREMAN' },
              { userId: 9, role: 'VIEWER' },
            ]),
        },
        material: { count: jest.fn().mockResolvedValue(4500) },
        materialPhoto: {
          aggregate: jest.fn().mockResolvedValue({ _count: { _all: 10 }, _sum: { sizeBytes: 100 * 1024 * 1024 } }),
        },
      };
      const service = makeService(prisma);

      const snap = await service.getSnapshot(7);

      expect(snap.plan.code).toBe('FOREMAN');
      expect(snap.left.objects).toBe(3);
      expect(snap.left.rows).toBe(500);
      expect(snap.left.photos).toBeNull(); // лимита по штукам на платном нет
      expect(snap.left.storageMb).toBe(2972);
      expect(snap.left.pdf).toBe(199);
      expect(snap.left.writers).toBe(2);
      expect(snap.left.viewers).toBe(4);
      expect(snap.enforced).toBe(false); // этап 0: ничего не блокируем
    });
  });

  describe('consumePdfExport', () => {
    it('начинает новый период и увеличивает счётчик', async () => {
      const update = jest.fn().mockResolvedValue({});
      const prisma = {
        subscription: {
          findUnique: jest.fn().mockResolvedValue(sub({ pdfUsed: 5, pdfPeriod: '2026-10' })),
          update,
        },
        plan: { findUnique: jest.fn().mockResolvedValue(plan({ code: 'FOREMAN', maxPdfPerMonth: 200 })) },
      };
      const service = makeService(prisma);

      const res = await service.consumePdfExport(7, new Date('2026-11-26T10:00:00Z'));

      expect(res).toEqual({ used: 1, limit: 200, left: 199 });
      expect(update).toHaveBeenCalledWith({
        where: { userId: 7 },
        data: { pdfUsed: 1, pdfPeriod: '2026-11' },
      });
    });

    it('в том же месяце — инкремент', async () => {
      const update = jest.fn().mockResolvedValue({});
      const prisma = {
        subscription: {
          findUnique: jest.fn().mockResolvedValue(sub({ pdfUsed: 2, pdfPeriod: '2026-11' })),
          update,
        },
        plan: { findUnique: jest.fn().mockResolvedValue(plan({ code: 'FOREMAN', maxPdfPerMonth: 200 })) },
      };
      const service = makeService(prisma);

      const res = await service.consumePdfExport(7, new Date('2026-11-26T10:00:00Z'));
      expect(res?.used).toBe(3);
      expect(update).toHaveBeenCalledWith({
        where: { userId: 7 },
        data: { pdfUsed: 3, pdfPeriod: '2026-11' },
      });
    });

    it('без подписки — null (лимит Free считает вызывающий)', async () => {
      const service = makeService({ subscription: { findUnique: jest.fn().mockResolvedValue(null) } });
      expect(await service.consumePdfExport(7)).toBeNull();
    });
  });
});
