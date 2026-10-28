// backend/src/imports/imports.service.spec.ts
// ⭐ №202: commit — атомарность, цена только из БД, пропуск дублей, права.
import { ConflictException, ForbiddenException } from '@nestjs/common';
import { ImportsService } from './imports.service';
import type { PreviewPayload, PreviewRow } from './imports.types';

const row = (over: Partial<PreviewRow> = {}): PreviewRow => ({
  row: 3,
  raw: { name: 'Укладка плитки', article: null, qty: '10', unit: 'м2' },
  name: 'Укладка плитки',
  qty: 10,
  unit: 'SQUARE_METER' as PreviewRow['unit'],
  unitApprox: false,
  article: null,
  work: { status: 'EXACT', priceItemId: 88, price: 950, score: 1, candidates: [] },
  filePrice: 1200,
  priceDeltaPct: 26.3,
  duplicate: null,
  warnings: [],
  errors: [],
  ...over,
});

const batchWith = (rows: PreviewRow[], status = 'PREVIEW') => ({
  id: 41,
  projectId: 10,
  importedById: 7,
  status,
  preview: { version: 1, rows } as unknown as PreviewPayload,
});

const makeService = (
  batch: ReturnType<typeof batchWith>,
  opts: { role?: string; existingKeys?: string[] } = {},
) => {
  const tx = {
    importBatch: {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      update: jest.fn().mockResolvedValue({}),
    },
    material: {
      findMany: jest.fn().mockResolvedValue((opts.existingKeys ?? []).map((externalKey) => ({ externalKey }))),
      create: jest.fn().mockResolvedValue({ id: 101 }),
    },
    priceItem: {
      findUnique: jest.fn().mockResolvedValue({
        price: 950,
        isActive: true,
        kind: 'WORK',
        ownerId: null,
      }),
    },
  };
  const prisma = {
    project: { findUnique: jest.fn().mockResolvedValue({ objectId: 5 }) },
    objectAccess: {
      findMany: jest.fn().mockResolvedValue([
        {
          objectId: 5,
          projectId: 10,
          role: opts.role ?? 'FOREMAN',
          hidePrices: false,
          isManager: false,
          isHidden: false,
          revokedAt: null,
        },
      ]),
    },
    importBatch: { findUnique: jest.fn().mockResolvedValue(batch) },
    $transaction: jest.fn(async (cb: (t: unknown) => unknown) => cb(tx)),
  };
  const audit = { log: jest.fn() };
  const parser = {} as never;
  const service = new ImportsService(prisma as never, audit as never, parser);
  return { service, prisma, tx, audit };
};

describe('ImportsService.commit (№202)', () => {
  it('пишет «готовые» строки, цену берёт из справочника, а не из файла', async () => {
    const { service, tx } = makeService(batchWith([row()]));

    const result = await service.commit({ batchId: 41, userId: 7 });

    expect(result.created).toBe(1);
    expect(tx.material.create).toHaveBeenCalledTimes(1);
    const data = tx.material.create.mock.calls[0][0].data;
    expect(Number(data.unitPrice)).toBe(950); // из БД, не 1200 из файла
    expect(Number(data.specQuantity)).toBe(10);
    expect(data.importBatchId).toBe(41);
    expect(data.importRowNumber).toBe(3);
    expect(data.isSpecLocked).toBe(false);
    expect(typeof data.externalKey).toBe('string');
  });

  it('строка «требует решения» без решения не пишется, с решением IMPORT — пишется', async () => {
    const fuzzy = row({ row: 4, work: { status: 'FUZZY', priceItemId: 88, price: 950, score: 0.9, candidates: [] } });
    const { service, tx } = makeService(batchWith([fuzzy]));

    const skipped = await service.commit({ batchId: 41, userId: 7 });
    expect(skipped.created).toBe(0);

    const { service: service2, tx: tx2 } = makeService(batchWith([fuzzy]));
    const imported = await service2.commit({
      batchId: 41,
      userId: 7,
      resolutions: [{ row: 4, action: 'IMPORT', workPriceItemId: 88 }],
    });
    expect(imported.created).toBe(1);
    expect(tx2.material.create).toHaveBeenCalledTimes(1);
  });

  it('повторный импорт того же файла не создаёт дубль', async () => {
    const first = makeService(batchWith([row()]));
    await first.service.commit({ batchId: 41, userId: 7 });
    const key = first.tx.material.create.mock.calls[0][0].data.externalKey as string;

    const second = makeService(batchWith([row()]), { existingKeys: [key] });
    const result = await second.service.commit({ batchId: 41, userId: 7 });

    expect(result.created).toBe(0);
    expect(second.tx.material.create).not.toHaveBeenCalled();
  });

  it('наблюдатель импортировать не может', async () => {
    const { service } = makeService(batchWith([row()]), { role: 'VIEWER' });
    await expect(service.commit({ batchId: 41, userId: 7 })).rejects.toThrow(ForbiddenException);
  });

  it('партия уже обработана ⇒ 409 (двойной клик)', async () => {
    const { service } = makeService(batchWith([row()], 'COMMITTED'));
    await expect(service.commit({ batchId: 41, userId: 7 })).rejects.toThrow(ConflictException);
  });

  it('строка с ошибкой (нет единицы) не пишется', async () => {
    const broken = row({ row: 5, unit: null, errors: ['Укажите единицу измерения'] });
    const { service, tx } = makeService(batchWith([broken]));

    const result = await service.commit({ batchId: 41, userId: 7 });
    expect(result.created).toBe(0);
    expect(tx.material.create).not.toHaveBeenCalled();
  });
});
