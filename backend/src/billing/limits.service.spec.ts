// backend/src/billing/limits.service.spec.ts
// ⭐ №407: лимиты в режимах off / shadow / on.
import { ForbiddenException } from '@nestjs/common';
import { LimitsService } from './limits.service';

const snapshot = (over: Record<string, any> = {}) => ({
  plan: {
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
  },
  usage: { objects: 1, rows: 150, photos: 5, storageMb: 0, writers: 0, viewers: 1, pdfUsed: 0 },
  ...over,
});

const make = (mode: 'off' | 'shadow' | 'on', snap = snapshot()) => {
  const billing: any = {
    mode,
    getSnapshot: jest.fn().mockResolvedValue(snap),
  };
  return { service: new LimitsService(billing), billing };
};

describe('LimitsService (№407)', () => {
  it('off — ничего не считает и не блокирует', async () => {
    const { service, billing } = make('off');
    const res = await service.check(7, 'objects');
    expect(res).toEqual({ allowed: true, kind: 'objects', limit: null, used: 0, left: null });
    expect(billing.getSnapshot).not.toHaveBeenCalled();
    await expect(service.assert(7, 'rows')).resolves.toBeUndefined();
  });

  it('shadow — считает, логирует, но не блокирует', async () => {
    const { service } = make('shadow');
    const res = await service.check(7, 'rows');
    expect(res.allowed).toBe(true); // пропускаем
    expect(res.shadowed).toBe(true);
    expect(res.code).toBe('LIMIT_ROWS');
    expect(res.limit).toBe(150);
    expect(res.used).toBe(150);
    expect(res.left).toBe(0);
    expect(res.message).toContain('5 000 строк');
    await expect(service.assert(7, 'rows')).resolves.toBeUndefined();
  });

  it('on — блокирует 403 с кодом и текстом апселла', async () => {
    const { service } = make('on');
    await expect(service.assert(7, 'objects')).rejects.toBeInstanceOf(ForbiddenException);
    try {
      await service.assert(7, 'objects');
    } catch (e: any) {
      expect(e.getResponse()).toMatchObject({ code: 'LIMIT_OBJECTS', statusCode: 403 });
      expect(e.getResponse().message).toContain('Прораб — 5 объектов');
    }
  });

  it('on: запас по лимиту учитывается (add)', async () => {
    const { service } = make('on', snapshot({ usage: { objects: 1, rows: 148, photos: 0, storageMb: 0, writers: 0, viewers: 0, pdfUsed: 0 } }));
    await expect(service.assert(7, 'rows', 2)).resolves.toBeUndefined(); // 148 + 2 = 150 — ровно лимит
    await expect(service.assert(7, 'rows', 3)).rejects.toBeInstanceOf(ForbiddenException); // 151 > 150
  });

  it('лимит по объёму (storage) не путается со слотами фото', async () => {
    const paid = snapshot({
      plan: { ...snapshot().plan, code: 'FOREMAN', maxPhotos: null, maxStorageMb: 3072 },
      usage: { objects: 2, rows: 100, photos: 900, storageMb: 3000, writers: 1, viewers: 0, pdfUsed: 5 },
    });
    const { service } = make('on', paid);
    // фото по штукам не ограничены
    await expect(service.assert(7, 'photos')).resolves.toBeUndefined();
    // а объём — на исходе
    await expect(service.assert(7, 'storage', 100)).rejects.toBeInstanceOf(ForbiddenException);
  });
});
