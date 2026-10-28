// backend/src/imports/imports.service.ts
// ⭐ №202 (RFC §8.3–8.5): партия импорта сметы — предпросмотр и commit.
// Главные правила: цены берём ТОЛЬКО из справочника, commit атомарный,
// повторный импорт того же файла не создаёт дубли (externalKey).
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  REVOKED_ACCESS_MESSAGE,
  loadAccessGrants,
  resolveProjectAccess,
} from '../auth/access-scope';
import { EstimateParserService } from './estimate-parser.service';
import { matchRow } from './price-matcher';
import { articleHasCyrillic, normalizeText, parseNumberRu } from './name-normalizer';
import { normalizeUnit } from './unit-normalizer';
import type { CatalogItem, ParsedEstimate, PreviewPayload, PreviewRow } from './imports.types';

export interface PreviewInput {
  projectId: number;
  userId: number;
  fileName?: string | null;
  rows?: unknown[][];
  buffer?: Buffer;
}

export interface CommitResolution {
  row: number;
  action: 'IMPORT' | 'SKIP';
  workPriceItemId?: number | null;
}

export interface CommitResolution {
  row: number;
  action: 'IMPORT' | 'SKIP';
  workPriceItemId?: number | null;
}

export interface CommitInput {
  batchId: number;
  userId: number;
  resolutions?: CommitResolution[];
}

const MAX_ROWS = 500;

@Injectable()
export class ImportsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private parser: EstimateParserService,
  ) {}

  /** Импорт — операция записи: наблюдатель и отозванный доступ не могут. */
  private async assertCanImport(projectId: number, userId: number) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { objectId: true },
    });
    if (!project) throw new NotFoundException('Проект не найден');
    const grants = await loadAccessGrants(this.prisma, userId);
    const my = resolveProjectAccess(grants, project.objectId, projectId);
    if (!my.role) throw new ForbiddenException('Нет доступа к этому проекту');
    if (my.revoked) throw new ForbiddenException(REVOKED_ACCESS_MESSAGE);
    if (!my.canWrite) throw new ForbiddenException('Наблюдатель не может импортировать смету');
    return project;
  }

  /** Каталог для матчинга: системные + личные активные РАБОЧИЕ расценки (RFC §7.2). */
  private async loadCatalog(userId: number): Promise<CatalogItem[]> {
    const items = await this.prisma.priceItem.findMany({
      where: { isActive: true, kind: 'WORK', OR: [{ ownerId: null }, { ownerId: userId }] },
      select: {
        id: true,
        name: true,
        article: true,
        unit: true,
        price: true,
        kind: true,
        category: { select: { name: true } },
      },
      take: 5000,
    });
    return items.map((i) => ({
      id: i.id,
      name: i.name,
      article: i.article,
      unit: i.unit,
      price: Number(i.price),
      kind: i.kind,
      category: i.category?.name ?? null,
    }));
  }

  async preview(input: PreviewInput): Promise<{ batchId: number } & PreviewPayload> {
    const { projectId, userId } = input;
    await this.assertCanImport(projectId, userId);

    let parsed: ParsedEstimate;
    if (input.buffer) {
      parsed = await this.parser.parseBuffer(input.buffer, input.fileName ?? 'import.xlsx');
    } else if (Array.isArray(input.rows)) {
      parsed = this.parser.parseRows(input.rows, input.fileName ?? 'Вставка из буфера');
    } else {
      throw new BadRequestException('Нужен файл или строки таблицы');
    }
    if (parsed.rows.length > MAX_ROWS) {
      throw new BadRequestException(
        `В файле ${parsed.rows.length} строк — больше лимита ${MAX_ROWS}. Разделите смету на части.`,
      );
    }

    const [catalog, existing] = await Promise.all([
      this.loadCatalog(userId),
      this.prisma.material.findMany({
        where: { projectId },
        select: { id: true, name: true, specQuantity: true, totalUsed: true },
      }),
    ]);
    const byName = new Map(existing.map((m) => [normalizeText(m.name), m]));

    const rows: PreviewRow[] = parsed.rows.map((raw) => {
      const unit = normalizeUnit(raw.unitRaw);
      const qty = parseNumberRu(raw.qtyRaw);
      const filePrice = parseNumberRu(raw.priceRaw);
      const work = matchRow({ name: raw.name, article: raw.article, unit: unit.unit }, catalog);
      const duplicate = byName.get(normalizeText(raw.name)) ?? null;

      const warnings: string[] = [];
      const errors: string[] = [];
      if (!unit.unit) errors.push('Укажите единицу измерения');
      if (unit.approx) warnings.push('Единица приведена приблизительно (пог. м → м)');
      if (qty == null || qty <= 0) errors.push('Укажите количество');
      if (raw.article && articleHasCyrillic(raw.article)) {
        warnings.push('Артикул содержит кириллицу — сверьте вручную');
      }
      const deltaPct =
        filePrice != null && work.price != null && work.price > 0
          ? Math.round(((filePrice - work.price) / work.price) * 1000) / 10
          : null;
      if (deltaPct != null && Math.abs(deltaPct) >= 20) {
        warnings.push(`Цена в файле отличается от справочника на ${deltaPct}%`);
      }
      if (duplicate) warnings.push('Позиция уже есть в смете — по умолчанию пропускаем');

      return {
        row: raw.row,
        raw: { name: raw.name, article: raw.article, qty: raw.qtyRaw, unit: raw.unitRaw },
        name: raw.name,
        qty,
        unit: unit.unit,
        unitApprox: unit.approx,
        article: raw.article,
        work,
        filePrice,
        priceDeltaPct: deltaPct,
        duplicate: duplicate
          ? {
              materialId: duplicate.id,
              specQuantity: Number(duplicate.specQuantity),
              totalUsed: Number(duplicate.totalUsed),
            }
          : null,
        warnings,
        errors,
      };
    });

    const stats = {
      // «Готово» — только точное совпадение: остальное человек подтверждает сам
      ready: rows.filter((r) => r.errors.length === 0 && !r.duplicate && r.work.status === 'EXACT')
        .length,
      needsDecision: rows.filter(
        (r) =>
          r.errors.length === 0 &&
          !r.duplicate &&
          (r.work.status === 'FUZZY' ||
            r.work.status === 'SUGGESTED' ||
            r.work.status === 'NONE'),
      ).length,
      errors: rows.filter((r) => r.errors.length > 0).length,
      duplicates: rows.filter((r) => !!r.duplicate).length,
    };
    const plannedCost = rows.reduce(
      (sum, r) =>
        sum + (r.errors.length === 0 && !r.duplicate ? (r.qty ?? 0) * (r.work.price ?? 0) : 0),
      0,
    );

    const payload: PreviewPayload = {
      version: 1,
      fileName: input.fileName ?? null,
      sheet: parsed.sheet,
      sheets: parsed.sheets,
      columns: parsed.columns,
      rows,
      stats,
      totals: {
        plannedCost: Math.round(plannedCost * 100) / 100,
        zeroPriceRows: rows.filter((r) => r.errors.length === 0 && r.work.price == null).length,
      },
    };

    const batch = await this.prisma.importBatch.create({
      data: {
        projectId,
        importedById: userId,
        fileName: input.fileName ?? null,
        fileHash: input.buffer ? createHash('sha1').update(input.buffer).digest('hex') : null,
        templateVersion: 1,
        status: 'PREVIEW',
        rowsTotal: rows.length,
        preview: payload as unknown as Prisma.InputJsonValue,
      },
      select: { id: true },
    });

    return { batchId: batch.id, ...payload };
  }

  /** Детерминированный ключ строки: повторный импорт того же файла не создаст дубль. */
  private externalKey(projectId: number, row: PreviewRow): string {
    return createHash('sha1')
      .update(`${projectId}|${row.row}|${normalizeText(row.name)}|${row.unit ?? ''}|${row.qty ?? ''}`)
      .digest('hex')
      .slice(0, 64);
  }

  async commit(input: CommitInput) {
    const batch = await this.prisma.importBatch.findUnique({ where: { id: input.batchId } });
    if (!batch) throw new NotFoundException('Партия импорта не найдена');
    await this.assertCanImport(batch.projectId, input.userId);
    if (batch.status !== 'PREVIEW') {
      throw new ConflictException('Партия уже обработана или отменена');
    }
    const preview = batch.preview as unknown as PreviewPayload | null;
    if (!preview) throw new BadRequestException('В партии нет данных предпросмотра');

    const resolutions = new Map<number, CommitResolution>(
      (input.resolutions ?? []).map((r) => [r.row, r]),
    );

    const summary = await this.prisma.$transaction(async (tx) => {
      // Идемпотентность против двойного клика: «захватываем» партию атомарно
      const claimed = await tx.importBatch.updateMany({
        where: { id: batch.id, status: 'PREVIEW' },
        data: { status: 'COMMITTING' },
      });
      if (claimed.count !== 1) {
        throw new ConflictException('Партия уже обрабатывается или отменена');
      }

      // Что пишем: явное решение IMPORT либо строки «готово» без решения
      const toImport = preview.rows.filter((r) => {
        const res = resolutions.get(r.row);
        if (res) return res.action === 'IMPORT';
        return r.errors.length === 0 && !r.duplicate && r.work.status === 'EXACT';
      });

      const keys = toImport.map((r) => this.externalKey(batch.projectId, r));
      const existing = await tx.material.findMany({
        where: { projectId: batch.projectId, externalKey: { in: keys } },
        select: { externalKey: true },
      });
      const existingKeys = new Set(existing.map((m) => m.externalKey).filter(Boolean) as string[]);

      let created = 0;
      const skipped: { row: number; reason: string }[] = [];

      for (const r of toImport) {
        if (!r.unit || r.qty == null) {
          skipped.push({ row: r.row, reason: 'Нет единицы или количества' });
          continue;
        }
        const key = this.externalKey(batch.projectId, r);
        if (existingKeys.has(key)) {
          skipped.push({ row: r.row, reason: 'Строка уже импортирована ранее' });
          continue;
        }

        // Цену берём ТОЛЬКО из БД (файл — предложение, не истина)
        const priceItemId = resolutions.get(r.row)?.workPriceItemId ?? r.work.priceItemId ?? null;
        let unitPrice = 0;
        if (priceItemId != null) {
          const item = await tx.priceItem.findUnique({
            where: { id: priceItemId },
            select: { price: true, isActive: true, kind: true, ownerId: true },
          });
          if (
            !item ||
            !item.isActive ||
            item.kind !== 'WORK' ||
            (item.ownerId != null && item.ownerId !== input.userId)
          ) {
            skipped.push({ row: r.row, reason: 'Расценка недоступна или неактивна' });
            continue;
          }
          unitPrice = Number(item.price);
        }

        await tx.material.create({
          data: {
            name: r.name,
            article: r.article,
            unit: r.unit,
            specQuantity: new Prisma.Decimal(r.qty),
            totalUsed: new Prisma.Decimal(0),
            totalCost: new Prisma.Decimal(0),
            materialTotalCost: new Prisma.Decimal(0),
            unitPrice: new Prisma.Decimal(unitPrice),
            materialUnitPrice: new Prisma.Decimal(0),
            priceItemId,
            isSpecLocked: false,
            note: null,
            projectId: batch.projectId,
            importBatchId: batch.id,
            importRowNumber: r.row,
            externalKey: key,
          },
          select: { id: true },
        });
        existingKeys.add(key);
        created += 1;
      }

      const skippedCount = preview.rows.length - created;
      const report = {
        created,
        skipped: skippedCount,
        skippedDetails: skipped.slice(0, 200),
        rowsTotal: preview.rows.length,
      };

      await tx.importBatch.update({
        where: { id: batch.id },
        data: {
          status: 'COMMITTED',
          createdCount: created,
          skippedCount,
          committedAt: new Date(),
          report: report as unknown as Prisma.InputJsonValue,
        },
      });

      return { batchId: batch.id, status: 'COMMITTED' as const, ...report };
    });

    await this.audit.log(input.userId, 'estimate_import', batch.id, 'commit', null, {
      projectId: batch.projectId,
      created: summary.created,
      skipped: summary.skipped,
    });

    return summary;
  }

  async getBatch(batchId: number, userId: number) {
    const batch = await this.prisma.importBatch.findUnique({ where: { id: batchId } });
    if (!batch) throw new NotFoundException('Партия импорта не найдена');
    await this.assertCanImport(batch.projectId, userId);
    return batch;
  }

  async listHistory(projectId: number, userId: number) {
    await this.assertCanImport(projectId, userId);
    return this.prisma.importBatch.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      take: 30,
      select: {
        id: true,
        fileName: true,
        status: true,
        rowsTotal: true,
        createdCount: true,
        skippedCount: true,
        createdAt: true,
        committedAt: true,
      },
    });
  }
}
