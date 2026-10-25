// backend/src/materials/materials.service.spec.ts
// ⭐ №159: новая расценка из сметы пишется в справочник проекта, а не в первый личный.
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { MaterialsService } from './materials.service';
import { shiftDateKey, wallDateKey } from './fix-window';
import { CreateFixDto } from './dto/create-fix.dto';
import { CreatePriceItemDto } from '../price-list/dto/create-price-item.dto';

/** Типизированный доступ к аргументам замоканного вызова (без `any`-цепочек). */
const callArg = <T>(mock: jest.Mock, callIndex = 0): T => {
  const calls = mock.mock.calls as unknown[][];
  return calls[callIndex][0] as T;
};

describe('MaterialsService — справочник новой расценки (№159)', () => {
  const prisma = {
    objectAccess: { findMany: jest.fn() },
    priceCategory: { findUnique: jest.fn() },
    priceCatalog: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    priceItem: { create: jest.fn() },
    object: { findMany: jest.fn() },
    project: { findMany: jest.fn() },
    user: { findUnique: jest.fn() },
  };
  const audit = { log: jest.fn() };
  let service: MaterialsService;

  const dto = {
    name: '  Штукатурка стен  ',
    unit: 'SQUARE_METER',
    price: 300,
    categoryId: 4,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.objectAccess.findMany.mockResolvedValue([]);
    prisma.priceCategory.findUnique.mockResolvedValue({
      id: 4,
      name: 'Отделка',
      kind: 'WORK',
    });
    prisma.priceItem.create.mockResolvedValue({ id: 100 });
    // ⭐ №164: доступ к справочнику считается через loadCatalogAccess
    prisma.priceCatalog.findUnique.mockResolvedValue({
      id: 8,
      name: 'Справочник проекта',
      ownerId: 7,
      isArchived: false,
    });
    prisma.object.findMany.mockResolvedValue([]);
    prisma.project.findMany.mockResolvedValue([]);
    prisma.user.findUnique.mockResolvedValue({ role: 'FOREMAN' });
    service = new MaterialsService(prisma as never, audit as never);
  });

  it('catalogId проекта: расценка пишется в него, личный справочник не ищется', async () => {
    await service.createPriceItemWithCategory(
      dto as CreatePriceItemDto,
      undefined,
      'WORK',
      7,
      8,
    );

    expect(prisma.priceCatalog.findUnique).toHaveBeenCalledWith({
      where: { id: 8 },
      select: { id: true, name: true, ownerId: true, isArchived: true },
    });
    expect(prisma.priceCatalog.findFirst).not.toHaveBeenCalled();
    expect(
      callArg<{ data: Record<string, unknown> }>(prisma.priceItem.create).data,
    ).toMatchObject({
      name: 'Штукатурка стен',
      categoryId: 4,
      catalogId: 8,
      ownerId: 7,
    });
  });

  it('архивный справочник ⇒ BadRequestException, расценка не создаётся', async () => {
    prisma.priceCatalog.findUnique.mockResolvedValue({
      id: 8,
      name: 'Справочник проекта',
      ownerId: 7,
      isArchived: true,
    });

    await expect(
      service.createPriceItemWithCategory(
        dto as CreatePriceItemDto,
        undefined,
        'WORK',
        7,
        8,
      ),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.priceItem.create).not.toHaveBeenCalled();
  });

  it('чужой справочник без доступа ⇒ NotFoundException', async () => {
    prisma.priceCatalog.findUnique.mockResolvedValue({
      id: 8,
      name: 'Чужой справочник',
      ownerId: 99,
      isArchived: false,
    });

    await expect(
      service.createPriceItemWithCategory(
        dto as CreatePriceItemDto,
        undefined,
        'WORK',
        7,
        8,
      ),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.priceItem.create).not.toHaveBeenCalled();
  });

  it('без catalogId — прежнее поведение: первый личный справочник', async () => {
    prisma.priceCatalog.findFirst.mockResolvedValue({
      id: 3,
      ownerId: 7,
      isArchived: false,
    });

    await service.createPriceItemWithCategory(
      dto as CreatePriceItemDto,
      undefined,
      'WORK',
      7,
    );

    expect(prisma.priceCatalog.findFirst).toHaveBeenCalledWith({
      where: { ownerId: 7 },
      orderBy: { id: 'asc' },
    });
    expect(
      callArg<{ data: Record<string, unknown> }>(prisma.priceItem.create).data,
    ).toMatchObject({
      catalogId: 3,
    });
  });
});

// ⭐ №162: копирование строки материала — план копируется, факт и фиксации нет
describe('MaterialsService — копирование строки (№162)', () => {
  const source = {
    id: 10,
    name: 'Стяжка пола',
    article: 'ST-10',
    unit: 'SQUARE_METER',
    specQuantity: 68,
    totalUsed: 20,
    note: 'черновая',
    projectId: 3,
    priceItemId: 5,
    unitPrice: 450,
    totalCost: 9000,
    materialItemId: null,
    materialUnitPrice: 0,
    materialTotalCost: 0,
    isSpecLocked: true,
  };
  const prisma = {
    objectAccess: { findFirst: jest.fn() },
    material: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
    },
  };
  const audit = { log: jest.fn() };
  let service: MaterialsService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.objectAccess.findFirst.mockResolvedValue({
      role: 'CUSTOMER',
      hidePrices: false,
    });
    prisma.material.findUnique.mockResolvedValue({
      ...source,
      project: { objectId: 1 },
    });
    prisma.material.findMany.mockResolvedValue([]);
    prisma.material.create.mockImplementation(
      (arg: { data: Record<string, unknown> }) =>
        Object.assign({ id: 11 }, arg.data),
    );
    service = new MaterialsService(prisma as never, audit as never);
  });

  it('копирует план, но не факт: totalUsed/totalCost = 0', async () => {
    const copy = await service.duplicate(10, 7);

    const data = callArg<{ data: Record<string, unknown> }>(
      prisma.material.create,
    ).data;
    expect(data).toMatchObject({
      name: 'Стяжка пола (копия)',
      specQuantity: 68,
      totalUsed: 0,
      totalCost: 0,
      priceItemId: 5,
      unitPrice: 450,
      projectId: 3,
    });
    expect(copy.id).toBe(11);
    expect(audit.log).toHaveBeenCalledWith(
      7,
      'material',
      11,
      'create',
      undefined,
      { name: 'Стяжка пола (копия)', copiedFrom: 10 },
    );
  });

  it('именует копии по уже занятым именам: «(копия)» → «(копия 2)»', async () => {
    prisma.material.findMany.mockResolvedValue([
      { name: 'Стяжка пола (копия)' },
    ]);

    await service.duplicate(10, 7);

    expect(
      callArg<{ data: Record<string, unknown> }>(prisma.material.create).data
        .name,
    ).toBe('Стяжка пола (копия 2)');
  });

  it('двойной клик по «Дублировать» не создаёт две «(копия)»', async () => {
    prisma.material.findMany.mockResolvedValue([
      { name: 'Стяжка пола (копия)' },
      { name: 'Стяжка пола (копия 2)' },
    ]);

    await service.duplicate(10, 7);

    expect(
      callArg<{ data: Record<string, unknown> }>(prisma.material.create).data
        .name,
    ).toBe('Стяжка пола (копия 3)');
  });

  it('копия с копии продолжает нумерацию от исходного имени', async () => {
    prisma.material.findUnique.mockResolvedValue({
      ...source,
      name: 'Стяжка пола (копия)',
      project: { objectId: 1 },
    });
    prisma.material.findMany.mockResolvedValue([
      { name: 'Стяжка пола (копия)' },
    ]);

    await service.duplicate(10, 7);

    expect(
      callArg<{ data: Record<string, unknown> }>(prisma.material.create).data
        .name,
    ).toBe('Стяжка пола (копия 2)');
  });

  it('VIEWER не может копировать (403)', async () => {
    prisma.objectAccess.findFirst.mockResolvedValue({
      role: 'VIEWER',
      hidePrices: true,
    });

    await expect(service.duplicate(10, 7)).rejects.toThrow(ForbiddenException);
    expect(prisma.material.create).not.toHaveBeenCalled();
  });
});

// ⭐ №174: окно фиксации — в будущее нельзя, назад «сегодня + 3 дня»;
// подпись «последняя фиксация» не откатывается записью задним числом;
// правка последней фиксации — 72 часа от момента ВНЕСЕНИЯ (createdAt).
describe('MaterialsService — окно фиксации (№174)', () => {
  const DAY_MS = 24 * 60 * 60 * 1000;
  const tz = new Date().getTimezoneOffset();
  const todayKey = () => wallDateKey(new Date(), tz);

  const materialRow = {
    id: 10,
    totalUsed: 20,
    specQuantity: 100,
    unitPrice: 100,
    materialUnitPrice: 50,
    lastEntryDate: null as Date | null,
  };

  /** Что реально уходит в Postgres из addFix / editLastFix. */
  interface FixCreate {
    materialId: number;
    amount: number;
    note: string | null;
    userId: number | null;
    fixedAt: Date;
  }
  interface FixUpdate {
    amount: number;
    isEdited: boolean;
    editedAt: Date;
  }
  interface MaterialUpdate {
    totalUsed: number;
    progressPercent: number;
    totalCost: number;
    materialTotalCost: number;
    lastEntry?: number | null;
    lastEntryDate?: Date | null;
  }

  const tx = {
    $queryRaw: jest.fn(),
    materialFix: {
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    material: { update: jest.fn() },
  };
  const prisma = {
    $transaction: jest.fn(),
    materialFix: { findFirst: jest.fn() },
    material: { update: jest.fn(), findUnique: jest.fn() },
    objectAccess: { findFirst: jest.fn() },
  };
  const audit = { log: jest.fn() };
  let service: MaterialsService;

  /** Аргумент `data`, который сервис передал в materialFix.create. */
  const createdFix = (callIndex = 0): FixCreate =>
    callArg<{ data: FixCreate }>(tx.materialFix.create, callIndex).data;
  /** Аргумент `data`, который сервис передал в material.update. */
  const updatedMaterial = (callIndex = 0): MaterialUpdate =>
    callArg<{ data: MaterialUpdate }>(tx.material.update, callIndex).data;
  /** Аргумент `data`, который сервис передал в materialFix.update. */
  const updatedFix = (callIndex = 0): FixUpdate =>
    callArg<{ data: FixUpdate }>(tx.materialFix.update, callIndex).data;

  beforeEach(() => {
    jest.clearAllMocks();
    materialRow.lastEntryDate = null;
    tx.$queryRaw.mockResolvedValue([{ ...materialRow }]);
    tx.materialFix.create.mockResolvedValue({ id: 500 });
    tx.materialFix.update.mockResolvedValue({ id: 500 });
    tx.material.update.mockImplementation((arg: { data: MaterialUpdate }) => ({
      id: 10,
      ...arg.data,
    }));
    prisma.$transaction.mockImplementation((cb: (client: unknown) => unknown) =>
      Promise.resolve(cb(tx)),
    );
    prisma.materialFix.findFirst.mockResolvedValue(null);
    service = new MaterialsService(prisma as never, audit as never);
  });

  it('фиксация «на завтра» ⇒ BadRequestException, транзакция не открывается', async () => {
    await expect(
      service.addFix(10, {
        amount: 5,
        fixedDate: shiftDateKey(todayKey(), 1),
        tzOffset: tz,
      } as CreateFixDto),
    ).rejects.toThrow(BadRequestException);

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(tx.materialFix.create).not.toHaveBeenCalled();
  });

  it('фиксация «−4 дня» ⇒ BadRequestException (окно 3 дня)', async () => {
    await expect(
      service.addFix(10, {
        amount: 5,
        fixedDate: shiftDateKey(todayKey(), -4),
        tzOffset: tz,
      } as CreateFixDto),
    ).rejects.toThrow(BadRequestException);

    expect(tx.materialFix.create).not.toHaveBeenCalled();
  });

  it('несуществующая дата 2026-02-30 ⇒ BadRequestException', async () => {
    await expect(
      service.addFix(10, {
        amount: 5,
        fixedDate: '2026-02-30',
        tzOffset: tz,
      } as CreateFixDto),
    ).rejects.toThrow('Дата фиксации должна быть в формате ГГГГ-ММ-ДД');
  });

  it('без даты — фиксируем «сейчас»', async () => {
    const before = Date.now();
    await service.addFix(10, { amount: 5 } as CreateFixDto);
    const after = Date.now();

    const fixedAt = createdFix().fixedAt;
    expect(fixedAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(fixedAt.getTime()).toBeLessThanOrEqual(after);
  });

  it('«вчера» — полдень выбранного дня по календарю устройства', async () => {
    const yesterday = shiftDateKey(todayKey(), -1);
    const [y, m, d] = yesterday.split('-').map(Number);
    const expected = new Date(Date.UTC(y, m - 1, d, 12, 0, 0, 0) + tz * 60_000);

    await service.addFix(10, {
      amount: 5,
      fixedDate: yesterday,
      tzOffset: tz,
    } as CreateFixDto);

    const data = createdFix();
    expect(data.fixedAt.getTime()).toBe(expected.getTime());
    expect(data.materialId).toBe(10);
    expect(data.amount).toBe(5);
  });

  it('фиксация задним числом не откатывает lastEntry/lastEntryDate', async () => {
    tx.$queryRaw.mockResolvedValue([
      { ...materialRow, lastEntryDate: new Date() },
    ]);

    await service.addFix(10, {
      amount: 5,
      fixedDate: shiftDateKey(todayKey(), -3),
      tzOffset: tz,
    } as CreateFixDto);

    const data = updatedMaterial();
    expect(data).not.toHaveProperty('lastEntry');
    expect(data).not.toHaveProperty('lastEntryDate');
    // Объём и стоимости при этом пересчитаны
    expect(data.totalUsed).toBe(25);
    expect(data.progressPercent).toBe(25);
    expect(data.totalCost).toBe(2500);
    expect(data.materialTotalCost).toBe(1250);
  });

  it('фиксация свежее предыдущей ⇒ lastEntry/lastEntryDate обновляются', async () => {
    tx.$queryRaw.mockResolvedValue([
      { ...materialRow, lastEntryDate: new Date(Date.now() - 5 * DAY_MS) },
    ]);

    await service.addFix(10, {
      amount: 7,
      fixedDate: shiftDateKey(todayKey(), -1),
      tzOffset: tz,
    } as CreateFixDto);

    const data = updatedMaterial();
    expect(data.lastEntry).toBe(7);
    expect(data.lastEntryDate).toBeInstanceOf(Date);
    expect(data.totalUsed).toBe(27);
  });

  it('правка: фиксация ВНЕСЕНА 4 дня назад ⇒ BadRequestException', async () => {
    prisma.materialFix.findFirst.mockResolvedValue({
      id: 500,
      materialId: 10,
      amount: 5,
      note: null,
      fixedAt: new Date(),
      createdAt: new Date(Date.now() - 4 * DAY_MS),
    });

    await expect(
      service.editLastFix(10, { amount: 6 } as CreateFixDto),
    ).rejects.toThrow(
      'Исправить можно только фиксацию, внесённую не позже 72 часов назад',
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('правка: работа 5 дней назад, но внесена 2 часа назад ⇒ разрешена', async () => {
    const lastFix = {
      id: 500,
      materialId: 10,
      amount: 5,
      note: null,
      fixedAt: new Date(Date.now() - 5 * DAY_MS),
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    };
    prisma.materialFix.findFirst.mockResolvedValue(lastFix);
    tx.materialFix.findFirst.mockResolvedValue(lastFix);

    await service.editLastFix(10, { amount: 9 } as CreateFixDto);

    expect(updatedFix()).toMatchObject({
      amount: 9,
      isEdited: true,
    });
    expect(updatedMaterial().totalUsed).toBe(24);
    // Дата последней фиксации не переписывается на «сейчас»
    expect(updatedMaterial().lastEntryDate).toBe(lastFix.fixedAt);
  });

  it('правка: старая строка без createdAt ⇒ окно считается от fixedAt', async () => {
    prisma.materialFix.findFirst.mockResolvedValue({
      id: 500,
      materialId: 10,
      amount: 5,
      note: null,
      fixedAt: new Date(Date.now() - 5 * DAY_MS),
      createdAt: null,
    });

    await expect(
      service.editLastFix(10, { amount: 6 } as CreateFixDto),
    ).rejects.toThrow(BadRequestException);
  });
});
