// backend/src/price-list/price-template-update.service.ts
// ⭐ №278 (§122): «Обновить из образца» — подтянуть новые позиции и цены
// из системного справочника (templateId) в личную базу пользователя.
// Два режима: только новые позиции / новые + обновить цены.
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PriceKind, Unit } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { normalizeText } from '../imports/name-normalizer';
import { PriceListService } from './price-list.service';

export type TemplateUpdateMode = 'missing' | 'all';

interface TemplateRow {
  templateItemId: number;
  itemId: number | null;
  action: 'add' | 'price';
  name: string;
  unit: Unit;
  kind: PriceKind;
  oldPrice: number | null;
  newPrice: number;
  categoryId: number;
}

export interface TemplateUpdatePreview {
  available: boolean;
  catalog: {
    id: number;
    name: string;
    ownerId: number | null;
    templateId: number | null;
    templateVersion: number | null;
  };
  template: { id: number; name: string; version: number | null };
  stats: { add: number; price: number };
  rows: Omit<TemplateRow, 'categoryId'>[];
}

@Injectable()
export class PriceTemplateUpdateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly prices: PriceListService,
    private readonly audit: AuditService,
  ) {}

  private async load(catalogId: number, userId: number) {
    await this.prices.assertCanEditCatalog(catalogId, userId);
    const catalog = await this.prisma.priceCatalog.findUnique({
      where: { id: catalogId },
      select: {
        id: true,
        name: true,
        ownerId: true,
        templateId: true,
        templateVersion: true,
      },
    });
    if (!catalog) throw new NotFoundException('Справочник не найден');
    if (!catalog.templateId) {
      throw new BadRequestException(
        'Этот справочник создан не из образца — обновлять из образца нечего',
      );
    }
    const template = await this.prisma.priceCatalog.findUnique({
      where: { id: catalog.templateId },
      select: { id: true, name: true, templateVersion: true },
    });
    if (!template) throw new BadRequestException('Образец не найден');
    return { catalog, template };
  }

  /** Полный список изменений: что добавить и где цена отличается */
  private async buildRows(catalogId: number, templateId: number): Promise<TemplateRow[]> {
    const [targetItems, templateItems] = await Promise.all([
      this.prisma.priceItem.findMany({
        where: { catalogId },
        select: { id: true, name: true, unit: true, kind: true, price: true, isActive: true },
      }),
      this.prisma.priceItem.findMany({
        where: { catalogId: templateId, isActive: true },
        select: { id: true, name: true, unit: true, kind: true, price: true, categoryId: true },
      }),
    ]);

    const byKey = new Map<string, (typeof targetItems)[number]>();
    for (const item of targetItems) {
      const key = `${item.kind}|${normalizeText(item.name)}|${item.unit}`;
      if (!byKey.has(key)) byKey.set(key, item);
    }

    const rows: TemplateRow[] = [];
    for (const item of templateItems) {
      const key = `${item.kind}|${normalizeText(item.name)}|${item.unit}`;
      const found = byKey.get(key);
      const newPrice = Number(item.price);
      if (!found) {
        rows.push({
          templateItemId: item.id,
          itemId: null,
          action: 'add',
          name: item.name,
          unit: item.unit,
          kind: item.kind,
          oldPrice: null,
          newPrice,
          categoryId: item.categoryId,
        });
        continue;
      }
      // позицию пользователь убрал сам — не возвращаем
      if (!found.isActive) continue;
      const oldPrice = Number(found.price);
      if (Math.abs(oldPrice - newPrice) >= 0.01) {
        rows.push({
          templateItemId: item.id,
          itemId: found.id,
          action: 'price',
          name: found.name,
          unit: found.unit,
          kind: found.kind,
          oldPrice,
          newPrice,
          categoryId: item.categoryId,
        });
      }
    }

    // сначала новые позиции, затем изменения цен (по убыванию разницы)
    rows.sort((a, b) => {
      if (a.action !== b.action) return a.action === 'add' ? -1 : 1;
      return (
        Math.abs((b.newPrice ?? 0) - (b.oldPrice ?? 0)) -
        Math.abs((a.newPrice ?? 0) - (a.oldPrice ?? 0))
      );
    });
    return rows;
  }

  async preview(catalogId: number, userId: number): Promise<TemplateUpdatePreview> {
    const { catalog, template } = await this.load(catalogId, userId);
    const rows = await this.buildRows(catalogId, catalog.templateId as number);
    const add = rows.filter((row) => row.action === 'add').length;
    const price = rows.filter((row) => row.action === 'price').length;
    const versionBehind =
      template.templateVersion != null &&
      (catalog.templateVersion == null || catalog.templateVersion < template.templateVersion);

    return {
      available: rows.length > 0 || versionBehind,
      catalog: {
        id: catalog.id,
        name: catalog.name,
        ownerId: catalog.ownerId,
        templateId: catalog.templateId,
        templateVersion: catalog.templateVersion,
      },
      template: {
        id: template.id,
        name: template.name,
        version: template.templateVersion,
      },
      stats: { add, price },
      // UI показывает первые 200 строк; полный список используется при применении
      rows: rows.slice(0, 200).map(({ categoryId: _categoryId, ...row }) => row),
    };
  }

  async apply(catalogId: number, userId: number, mode: TemplateUpdateMode) {
    const { catalog, template } = await this.load(catalogId, userId);
    const rows = await this.buildRows(catalogId, catalog.templateId as number);
    const addRows = rows.filter((row) => row.action === 'add');
    const priceRows = mode === 'all' ? rows.filter((row) => row.action === 'price') : [];

    if (addRows.length === 0 && priceRows.length === 0) {
      return {
        added: 0,
        updatedPrices: 0,
        templateVersion: template.templateVersion,
        message: 'Обновлять нечего: база уже соответствует образцу.',
      };
    }

    const result = await this.prisma.$transaction(async (tx) => {
      let added = 0;
      let updatedPrices = 0;

      if (addRows.length > 0) {
        await tx.priceItem.createMany({
          data: addRows.map((row) => ({
            ownerId: catalog.ownerId,
            catalogId,
            name: row.name,
            unit: row.unit,
            price: row.newPrice,
            categoryId: row.categoryId,
            kind: row.kind,
            isActive: true,
          })),
        });
        added = addRows.length;
      }

      for (const row of priceRows) {
        if (row.itemId == null) continue;
        await tx.priceItem.update({
          where: { id: row.itemId },
          data: { price: row.newPrice },
        });
        updatedPrices += 1;
      }

      await tx.priceCatalog.update({
        where: { id: catalogId },
        data: { templateVersion: template.templateVersion ?? catalog.templateVersion },
      });

      return { added, updatedPrices };
    });

    await this.audit.log(
      userId,
      'price_catalog',
      catalogId,
      'template_update',
      { fromVersion: catalog.templateVersion },
      { toVersion: template.templateVersion, mode, ...result },
    );

    const parts = [
      result.added > 0 ? `добавлено ${result.added}` : null,
      result.updatedPrices > 0 ? `обновлено цен ${result.updatedPrices}` : null,
    ].filter((part): part is string => Boolean(part));

    return {
      ...result,
      templateVersion: template.templateVersion,
      message: parts.length > 0 ? `Из образца ${parts.join(', ')}.` : 'Изменений нет.',
    };
  }
}
