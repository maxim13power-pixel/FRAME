// backend/src/snapshots/snapshot-payload.spec.ts
// ⭐ №194 (F1 шаг 2): слепок на момент отзыва — что попало, что скрыто, где границы доступа.
import { buildSnapshotPayload } from './snapshot-payload';

const object = {
  id: 5,
  name: 'ЖК «Северный парк»',
  address: 'Казань, ул. Северная, 2',
  startDate: new Date('2026-01-10'),
  endDate: new Date('2026-12-31'),
  plannedEndDate: null,
  note: null,
};

const project = {
  id: 10,
  name: 'Монолитные работы',
  startDate: new Date('2026-02-01'),
  endDate: new Date('2026-06-01'),
  note: null,
  materials: [
    {
      name: 'Бетон B25',
      article: 'B25',
      unit: 'CUBIC_METER',
      specQuantity: 120,
      totalUsed: 40,
      lastEntryDate: new Date('2026-05-01'),
      isSpecLocked: true,
      note: null,
      unitPrice: 1500,
      materialUnitPrice: 800,
    },
  ],
};

const report = {
  id: 3,
  projectId: 10,
  type: 'act',
  title: 'Акт за май',
  status: 'draft',
  totalAmount: 5400,
  comment: null,
  createdAt: new Date('2026-05-31'),
  items: [{ name: 'Заливка', unit: 'м³', quantity: 12, price: 450, total: 5400 }],
};

const brigade = {
  name: 'Бетонщики №1',
  specialty: 'бетон',
  foremanName: 'Иванов',
  phone: null,
  comment: null,
  members: [{ fullName: 'Петров', role: 'рабочий', phone: null }],
  shifts: [
    {
      date: new Date('2026-05-05'),
      hoursWorked: 8,
      outputValue: 20000,
      outputArea: 30,
      comment: null,
      project: { name: 'Монолитные работы' },
      members: [{ fullName: 'Петров', hours: 8 }],
    },
    {
      date: new Date('2026-05-06'),
      hoursWorked: 7,
      outputValue: null,
      outputArea: null,
      comment: null,
      project: null,
      members: [{ fullName: 'Петров', hours: 7 }],
    },
  ],
};

const makeTx = (options: { objectMissing?: boolean } = {}) =>
  ({
    object: {
      findUnique: jest.fn().mockResolvedValue(options.objectMissing ? null : object),
    },
    project: { findMany: jest.fn().mockResolvedValue([project]) },
    report: { findMany: jest.fn().mockResolvedValue([report]) },
    warehouseItem: {
      findMany: jest
        .fn()
        .mockResolvedValue([
          { name: 'Цемент', unit: 'мешок', category: 'расходник', quantity: 30, price: 400, comment: null },
        ]),
    },
    warehouseTransaction: {
      findMany: jest.fn().mockResolvedValue([
        {
          type: 'expense',
          quantity: 5,
          price: 400,
          comment: null,
          createdAt: new Date('2026-05-04'),
          warehouseItem: { name: 'Цемент' },
          project: { name: 'Монолитные работы' },
        },
      ]),
    },
    brigade: { findMany: jest.fn().mockResolvedValue([brigade]) },
  }) as any;

const scopeOfObject = {
  objectId: 5,
  projectId: null,
  hidePrices: false,
  takenAt: new Date('2026-10-28T10:00:00Z'),
};

describe('buildSnapshotPayload (№194)', () => {
  it('собирает объект, сметы, акты, склад и бригады с выходами', async () => {
    const result = await buildSnapshotPayload(makeTx(), scopeOfObject);
    expect(result).not.toBeNull();
    const payload = result!.payload as any;

    expect(result!.objectName).toBe('ЖК «Северный парк»');
    expect(result!.projectName).toBeNull(); // доступ был на весь объект
    expect(payload.object.address).toBe('Казань, ул. Северная, 2');
    expect(payload.projects[0].materials[0].name).toBe('Бетон B25');
    expect(payload.reports[0].items[0].total).toBe(5400);
    expect(payload.warehouse.items[0].name).toBe('Цемент');
    expect(payload.warehouse.transactions[0].itemName).toBe('Цемент');
    expect(payload.brigades[0].shifts[0].members[0].hours).toBe(8);
    expect(result!.summary).toEqual({
      projects: 1,
      materials: 1,
      reports: 1,
      warehouseItems: 1,
      warehouseTransactions: 1,
      brigades: 1,
      shifts: 2,
    });
  });

  it('hidePrices=true ⇒ деньги в слепок не попадают, объёмы остаются', async () => {
    const result = await buildSnapshotPayload(makeTx(), {
      ...scopeOfObject,
      hidePrices: true,
    });
    const payload = result!.payload as any;

    expect(payload.projects[0].materials[0].unitPrice).toBeNull();
    expect(payload.projects[0].materials[0].materialUnitPrice).toBeNull();
    expect(payload.projects[0].materials[0].specQuantity).toBe(120);
    expect(payload.reports[0].totalAmount).toBeNull();
    expect(payload.reports[0].items[0].price).toBeNull();
    expect(payload.reports[0].items[0].quantity).toBe(12);
    expect(payload.warehouse.items[0].price).toBeNull();
    expect(payload.warehouse.items[0].quantity).toBe(30);
    expect(payload.brigades[0].shifts[0].outputValue).toBeNull();
    expect(payload.brigades[0].shifts[0].hoursWorked).toBe(8);
  });

  it('доступ только на проект ⇒ проекты, акты и имя проекта в рамках этого проекта', async () => {
    const tx = makeTx();
    const result = await buildSnapshotPayload(tx, {
      ...scopeOfObject,
      projectId: 10,
    });

    expect(tx.project.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { objectId: 5, id: 10 } }),
    );
    expect(tx.report.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { objectId: 5, projectId: 10 } }),
    );
    expect(result!.projectName).toBe('Монолитные работы');
  });

  it('объекта уже нет ⇒ слепок не создаётся (отзыв не падает)', async () => {
    const result = await buildSnapshotPayload(makeTx({ objectMissing: true }), scopeOfObject);
    expect(result).toBeNull();
  });
});
