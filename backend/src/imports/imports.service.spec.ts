// backend/src/imports/imports.service.spec.ts
// ⭐ №202/№208: commit — атомарность, цена из справочника или из файла, дубли,
// права, видимость цен; preview — предупреждения и новый справочник.
import { ConflictException, ForbiddenException } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { ImportsService } from './imports.service';
import { EstimateParserService } from './estimate-parser.service';
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
  hasPrice: true,
  priceDeltaPct: 26.3,
  duplicate: null,
  warnings: [],
  errors: [],
  ...over,
});

const batchWith = (rows: PreviewRow[], status = 'PREVIEW', id = 41) => ({
  id,
  projectId: 10,
  importedById: 7,
  fileName: 'file.xlsx',
  status,
  preview: { version: 1, rows } as unknown as PreviewPayload,
});

const makeService = (
  batch: ReturnType<typeof batchWith>,
  opts: { role?: string; existingKeys?: string[]; hidePrices?: boolean } = {},
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
      // ⭐ №208: цены из файла пишутся в НОВЫЙ справочник
      create: jest.fn().mockResolvedValue({ id: 501 }),
    },
    priceCatalog: { create: jest.fn().mockResolvedValue({ id: 77, name: 'Импорт «file»' }) },
    priceCategory: { upsert: jest.fn().mockResolvedValue({ id: 9 }) },
  };
  const prisma = {
    project: { findUnique: jest.fn().mockResolvedValue({ objectId: 5 }) },
    objectAccess: {
      findMany: jest.fn().mockResolvedValue([
        {
          objectId: 5,
          projectId: 10,
          role: opts.role ?? 'FOREMAN',
          hidePrices: opts.hidePrices ?? false,
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

describe('ImportsService.commit (№202/№208)', () => {
  it('цена из файла → позиция в НОВОМ справочнике, материал получает её цену', async () => {
    const { service, tx } = makeService(batchWith([row()]));

    const result = await service.commit({ batchId: 41, userId: 7 });

    expect(result.created).toBe(1);
    expect(tx.priceCatalog.create).toHaveBeenCalledTimes(1);
    expect(tx.priceItem.create).toHaveBeenCalledTimes(1);
    expect(tx.material.create).toHaveBeenCalledTimes(1);
    const data = tx.material.create.mock.calls[0][0].data;
    expect(Number(data.unitPrice)).toBe(1200); // цена из файла
    expect(data.priceItemId).toBe(501); // и она же живёт в новом справочнике
    expect(Number(data.specQuantity)).toBe(10);
    expect(data.importBatchId).toBe(41);
    expect(data.importRowNumber).toBe(3);
    expect(data.isSpecLocked).toBe(false);
    expect(typeof data.externalKey).toBe('string');
  });

  it('строка без цены в файле берёт цену из справочника FRAME', async () => {
    const { service, tx } = makeService(
      batchWith([row({ filePrice: null, hasPrice: false })]),
    );

    await service.commit({ batchId: 41, userId: 7 });

    expect(tx.priceCatalog.create).not.toHaveBeenCalled();
    const data = tx.material.create.mock.calls[0][0].data;
    expect(Number(data.unitPrice)).toBe(950);
    expect(data.priceItemId).toBe(88);
  });

  it('строка без совпадения в справочнике пишется с нулевой ценой', async () => {
    const none = row({
      row: 6,
      filePrice: null,
      hasPrice: false,
      work: { status: 'NONE', priceItemId: null, price: null, score: 0, candidates: [] },
    });
    const { service, tx } = makeService(batchWith([none]));

    const result = await service.commit({ batchId: 41, userId: 7 });

    expect(result.created).toBe(1);
    expect(Number(tx.material.create.mock.calls[0][0].data.unitPrice)).toBe(0);
  });

  it('явный SKIP пропускает строку, IMPORT — пишет', async () => {
    const { service, tx } = makeService(batchWith([row()]));
    const skipped = await service.commit({
      batchId: 41,
      userId: 7,
      resolutions: [{ row: 3, action: 'SKIP' }],
    });
    expect(skipped.created).toBe(0);

    const second = makeService(batchWith([row()]));
    const imported = await second.service.commit({
      batchId: 41,
      userId: 7,
      resolutions: [{ row: 3, action: 'IMPORT' }],
    });
    expect(imported.created).toBe(1);
    expect(second.tx.material.create).toHaveBeenCalledTimes(1);
    expect(tx.material.create).not.toHaveBeenCalled();
  });

  // ⭐ №208: владелец разрешил дубли — повторная загрузка добавляет строки, а не складывает
  it('повторный импорт того же файла создаёт новые строки (дубли разрешены)', async () => {
    const first = makeService(batchWith([row()]));
    await first.service.commit({ batchId: 41, userId: 7 });
    const key = first.tx.material.create.mock.calls[0][0].data.externalKey as string;

    const second = makeService(batchWith([row()], 'PREVIEW', 42), { existingKeys: [key] });
    const result = await second.service.commit({ batchId: 42, userId: 7 });

    expect(result.created).toBe(1);
    expect(second.tx.material.create).toHaveBeenCalledTimes(1);
  });

  it('строка уже записанная в ЭТОЙ партии повторно не пишется', async () => {
    const batch = batchWith([row()]);
    const { service, tx } = makeService(batch);
    await service.commit({ batchId: 41, userId: 7 });
    const key = tx.material.create.mock.calls[0][0].data.externalKey as string;

    const second = makeService(batch, { existingKeys: [key] });
    const result = await second.service.commit({ batchId: 41, userId: 7 });
    expect(result.created).toBe(0);
  });

  it('наблюдатель импортировать не может', async () => {
    const { service } = makeService(batchWith([row()]), { role: 'VIEWER' });
    await expect(service.commit({ batchId: 41, userId: 7 })).rejects.toThrow(ForbiddenException);
  });

  it('цены скрыты, а в файле есть цены ⇒ 403', async () => {
    const { service } = makeService(batchWith([row()]), { hidePrices: true });
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

describe('ImportsService.preview (№208)', () => {
  const buildService = (opts: { hidePrices?: boolean } = {}) => {
    const prisma = {
      project: { findUnique: jest.fn().mockResolvedValue({ objectId: 5 }) },
      objectAccess: {
        findMany: jest.fn().mockResolvedValue([
          {
            objectId: 5,
            projectId: 10,
            role: 'FOREMAN',
            hidePrices: opts.hidePrices ?? false,
            isHidden: false,
            revokedAt: null,
          },
        ]),
      },
      priceItem: { findMany: jest.fn().mockResolvedValue([]) },
      material: { findMany: jest.fn().mockResolvedValue([]) },
      importBatch: { create: jest.fn().mockResolvedValue({ id: 41 }) },
    };
    const audit = { log: jest.fn() };
    const service = new ImportsService(
      prisma as never,
      audit as never,
      new EstimateParserService(),
    );
    return { service, prisma };
  };

  const rows = [
    ['Наименование', 'Ед. изм.', 'Количество', 'Цена'],
    ['Кабель ВВГ', 'м', '350', '95'],
    ['Давальческий песок', 'т', '10', ''],
  ];

  it('цены из файла → предложение нового справочника и пометка строк', async () => {
    const { service } = buildService();

    const preview = await service.preview({ projectId: 10, userId: 7, fileName: 'смета.xlsx', rows });

    expect(preview.prices.rows).toBe(1);
    expect(preview.prices.catalogName).toContain('Импорт');
    expect(preview.warnings.join(' ')).toContain('НОВЫЙ справочник');
    expect(preview.rows[0].hasPrice).toBe(true);
    expect(preview.rows[1].hasPrice).toBe(false);
    // строка без цены не ошибка — уйдёт с 0
    expect(preview.rows[1].errors).toHaveLength(0);
    expect(preview.totals.zeroPriceRows).toBe(1);
  });

  it('цены скрыты, а в файле есть цены ⇒ 403 с понятным текстом', async () => {
    const { service } = buildService({ hidePrices: true });

    await expect(
      service.preview({ projectId: 10, userId: 7, fileName: 'смета.xlsx', rows }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('файл выгружен из другого проекта ⇒ предупреждение, но импорт разрешён', async () => {
    const { service } = buildService();
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Материалы');
    rows.forEach((r) => ws.addRow(r));
    const meta = wb.addWorksheet('_meta');
    meta.addRow(['frameExport', 1]);
    meta.addRow(['projectId', 99]);
    meta.addRow(['projectName', 'Другой объект']);
    const buffer = Buffer.from(await wb.xlsx.writeBuffer());

    const preview = await service.preview({ projectId: 10, userId: 7, fileName: 'другой.xlsx', buffer });

    expect(preview.warnings.join(' ')).toContain('другого проекта');
    expect(preview.rows.length).toBe(2);
  });
});

