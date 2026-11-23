// backend/src/price-list-import/price-list-import.service.ts
// ⭐ №273 (§121): импорт прайса в справочник — предпросмотр, правки единиц, commit.
// Правило: файл НИКОГДА не отклоняется целиком. Нераспознанная единица → черновик
// (позиция создаётся, но неактивна), который уточняется в справочнике.
import { BadRequestException, Injectable } from '@nestjs/common';
import { PriceKind, Prisma, Unit } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { PriceListService } from '../price-list/price-list.service';
import { normalizeArticle, normalizeText } from '../imports/name-normalizer';
import { normalizeUnit, unitFamily, unitLabelRu } from '../imports/unit-normalizer';
import {
  BuildTemplateInput,
  ParsedPriceRow,
  ParsedPriceSheet,
  PriceTemplateService,
  TemplateSheetInput,
} from './price-template.service';
import type {
  PriceImportPreview,
  PriceImportResult,
  PriceImportRow,
  PriceImportSheet,
  PriceUnitGroup,
  PriceUnitOverrides,
} from './price-list-import.types';

const MAX_ROWS = 5000;

interface CatalogItemRow {
  id: number;
  name: string;
  article: string | null;
  unit: Unit;
  price: number;
  categoryId: number;
  isActive: boolean;
  needsClarification: boolean;
}

interface ItemIndex {
  byId: Map<number, CatalogItemRow>;
  byArticle: Map<string, CatalogItemRow | 'dup'>;
  byNameUnit: Map<string, CatalogItemRow | 'dup'>;
  byName: Map<string, CatalogItemRow | 'dup'>;
}

interface Evaluated {
  rows: PriceImportRow[];
  sheets: PriceImportSheet[];
  unitGroups: PriceUnitGroup[];
  stats: PriceImportPreview['stats'];
  warnings: string[];
}

/** Ключ группы правок: как написал пользователь, без регистра и пробелов по краям */
const unitKey = (raw: string | null): string => (raw ?? '').trim().toLowerCase();

@Injectable()
export class PriceListImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly prices: PriceListService,
    private readonly templates: PriceTemplateService,
    private readonly audit: AuditService,
  ) {}

  /**
   * ⭐ №338/№339: `templateOnly = true` — «Скачать шаблон»: заполненный ОБРАЗЕЦ (SYSTEM-
   * справочник), один и тот же для всех, независимо от содержимого личного справочника.
   * Без флага — выгрузка текущего справочника (для бэкапа/обмена).
   */
  async export(
    catalogId: number,
    kind: PriceKind,
    userId: number,
    templateOnly = false,
  ): Promise<{ fileName: string; buffer: Buffer }> {
    const access = await this.prices.assertCanEditCatalog(catalogId, userId);
    const suffix = kind === 'WORK' ? 'работы' : 'материалы';

    // ⭐ №339: источник шаблона — системный образец, а не данные справочника
    const sourceCatalogId = templateOnly
      ? ((await this.prisma.priceCatalog.findFirst({
          where: { kind: 'SYSTEM' },
          select: { id: true },
          orderBy: { id: 'asc' },
        }))?.id ?? null)
      : catalogId;

    const items = sourceCatalogId
      ? await this.prisma.priceItem.findMany({
          where: { catalogId: sourceCatalogId, kind, isActive: true },
          select: {
            id: true,
            name: true,
            article: true,
            unit: true,
            price: true,
            categoryId: true,
            category: { select: { name: true, sortOrder: true } },
          },
          orderBy: [{ category: { sortOrder: 'asc' } }, { name: 'asc' }],
        })
      : [];

    const byCategory = new Map<string, TemplateSheetInput>();
    for (const item of items) {
      const name = item.category?.name ?? 'Разное';
      const sheet = byCategory.get(name) ?? { sheet: name, category: name, items: [] };
      sheet.items.push({
        // ⭐ №339: в шаблоне не пишем ID образца — импорт создаст позиции по названию
        id: templateOnly ? undefined : item.id,
        name: item.name,
        article: item.article,
        unit: item.unit,
        price: Number(item.price),
      });
      byCategory.set(name, sheet);
    }

    const input: BuildTemplateInput = {
      catalogId,
      catalogName: access.catalog.name,
      kind,
      sheets: [...byCategory.values()],
    };
    if (input.sheets.length === 0) {
      input.sheets = [{ sheet: 'Разное', category: 'Разное', items: [] }];
    }

    const buffer = await this.templates.build(input);
    return {
      fileName: templateOnly
        ? `Шаблон прайса — ${suffix}.xlsx`
        : `Прайс «${access.catalog.name}» — ${suffix}.xlsx`,
      buffer,
    };
  }

  private assertKind(
    fileKind: PriceKind | null,
    template: boolean,
    requested: PriceKind,
  ): void {
    if (!template || !fileKind || fileKind === requested) return;
    const fileLabel = fileKind === 'WORK' ? 'работ' : 'материалов';
    const tabLabel = requested === 'WORK' ? 'Работы' : 'Материалы';
    throw new BadRequestException(
      `Это шаблон ${fileLabel}. Откройте вкладку «${tabLabel}» и загрузите файл там.`,
    );
  }

  /** Предпросмотр: что будет создано/обновлено/пропущено. Ничего не пишет */
  async preview(input: {
    catalogId: number;
    kind: PriceKind;
    userId: number;
    fileName: string | null;
    buffer: Buffer;
    overrides?: PriceUnitOverrides;
  }): Promise<PriceImportPreview> {
    const access = await this.prices.assertCanEditCatalog(input.catalogId, input.userId);
    const parsed = await this.templates.parse(input.buffer);
    this.assertKind(parsed.kind, parsed.template, input.kind);

    const rowsTotal = parsed.sheets.reduce((acc, sheet) => acc + sheet.rows.length, 0);
    if (rowsTotal === 0) {
      throw new BadRequestException(
        'В файле нет заполненных строк. Заполните листы шаблона: Наименование, Ед. изм., Цена.',
      );
    }
    if (rowsTotal > MAX_ROWS) {
      throw new BadRequestException(
        `В файле ${rowsTotal} строк — больше лимита ${MAX_ROWS}. Разделите прайс на части.`,
      );
    }

    const evaluated = await this.evaluate(
      input.catalogId,
      input.kind,
      parsed.sheets,
      input.overrides ?? {},
    );

    const warnings: string[] = [];
    if (!parsed.template) {
      warnings.push(
        'Это не шаблон FRAME — колонки определены по заголовкам. Проверьте предпросмотр перед импортом.',
      );
    }
    if (parsed.catalogId != null && parsed.catalogId !== input.catalogId) {
      warnings.push(
        `Файл выгружен из другого справочника${
          parsed.catalogName ? ` («${parsed.catalogName}»)` : ''
        }. Импорт разрешён — позиции попадут в текущий справочник.`,
      );
    }

    return {
      fileName: input.fileName,
      kind: input.kind,
      catalog: { id: access.catalog.id, name: access.catalog.name },
      template: parsed.template,
      sheets: evaluated.sheets,
      rows: evaluated.rows,
      unitGroups: evaluated.unitGroups,
      stats: evaluated.stats,
      warnings: [...warnings, ...evaluated.warnings],
    };
  }

  /** Сопоставление строк файла с позициями справочника */
  private async evaluate(
    catalogId: number,
    kind: PriceKind,
    sheets: ParsedPriceSheet[],
    overrides: PriceUnitOverrides,
  ): Promise<Evaluated> {
    const [items, categories] = await Promise.all([
      this.prisma.priceItem.findMany({
        where: { catalogId, kind },
        select: {
          id: true,
          name: true,
          article: true,
          unit: true,
          price: true,
          categoryId: true,
          isActive: true,
          needsClarification: true,
        },
      }),
      this.prisma.priceCategory.findMany({
        where: { kind, OR: [{ catalogId }, { catalogId: null }] },
        select: { id: true, name: true, catalogId: true },
      }),
    ]);

    const index = this.buildIndex(
      items.map((item) => ({ ...item, price: Number(item.price) })),
    );
    // ⭐ №373 (B2): своя категория справочника приоритетнее системной
    const categoryByName = new Map<
      string,
      { id: number; name: string; catalogId: number | null }
    >();
    for (const category of categories) {
      const key = normalizeText(category.name);
      if (!categoryByName.has(key) || category.catalogId != null) {
        categoryByName.set(key, category);
      }
    }

    const rows: PriceImportRow[] = [];
    const groups = new Map<string, { raw: string; count: number }>();
    const resultSheets: PriceImportSheet[] = [];

    for (const sheet of sheets) {
      const categoryName = sheet.category.trim() || sheet.sheet;
      const category = categoryByName.get(normalizeText(categoryName));
      resultSheets.push({
        sheet: sheet.sheet,
        category: categoryName,
        rows: sheet.rows.length,
        newCategory: !category,
        skipped: sheet.rows.length === 0,
      });
      if (sheet.rows.length === 0) continue;

      for (const parsed of sheet.rows) {
        const rawKey = unitKey(parsed.unitRaw);
        const override = rawKey ? overrides[rawKey] : undefined;
        const guessed = override
          ? { unit: override as Unit, approx: false }
          : normalizeUnit(parsed.unitRaw);
        const unit = guessed.unit;

        const target = this.match(index, parsed, unit);
        const changes: string[] = [];
        const warnings: string[] = [];

        if (target) {
          if (parsed.price != null && Math.abs(Number(target.price) - parsed.price) >= 0.01) {
            changes.push(`цена ${Number(target.price)} → ${parsed.price}`);
          }
          if (normalizeText(parsed.name) !== normalizeText(target.name)) changes.push('название');
          if ((parsed.article ?? '') !== (target.article ?? '')) changes.push('артикул');
          if (unit && unit !== target.unit) {
            changes.push(`единица ${unitLabelRu(target.unit)} → ${unitLabelRu(unit)}`);
          }
          if (category && target.categoryId !== category.id) changes.push('категория');
          if (!unit && parsed.unitRaw) {
            warnings.push(
              `Единица «${parsed.unitRaw}» не распознана — у позиции останется ${unitLabelRu(target.unit)}`,
            );
          }
        } else if (parsed.price == null) {
          warnings.push('Цена не указана — позиция сохранится с ценой 0');
        }

        const needsUnit = !unit && !target;
        if (needsUnit) {
          const group = groups.get(rawKey) ?? { raw: parsed.unitRaw?.trim() ?? '', count: 0 };
          group.count += 1;
          groups.set(rawKey, group);
        }

        rows.push({
          key: `${sheet.sheet}!${parsed.row}`,
          sheet: sheet.sheet,
          row: parsed.row,
          id: parsed.id,
          targetId: target?.id ?? null,
          name: parsed.name,
          article: parsed.article,
          unitRaw: parsed.unitRaw,
          unit,
          unitApprox: guessed.approx,
          price: parsed.price,
          note: parsed.note,
          category: categoryName,
          action: target ? (changes.length > 0 ? 'update' : 'unchanged') : 'create',
          matchedBy: target ? this.matchedBy(parsed, target) : null,
          needsUnit,
          changes,
          warnings,
        });
      }
    }

    const unitGroups: PriceUnitGroup[] = [...groups.entries()].map(([key, group]) => ({
      raw: group.raw,
      key,
      count: group.count,
      suggestion: null,
      approx: false,
    }));

    return {
      rows,
      sheets: resultSheets,
      unitGroups,
      stats: {
        total: rows.length,
        create: rows.filter((r) => r.action === 'create').length,
        update: rows.filter((r) => r.action === 'update').length,
        unchanged: rows.filter((r) => r.action === 'unchanged').length,
        needsUnit: rows.filter((r) => r.needsUnit).length,
        warnings: rows.filter((r) => r.warnings.length > 0).length,
      },
      warnings: [],
    };
  }

  private buildIndex(items: CatalogItemRow[]): ItemIndex {
    const byId = new Map<number, CatalogItemRow>();
    const byArticle = new Map<string, CatalogItemRow | 'dup'>();
    const byNameUnit = new Map<string, CatalogItemRow | 'dup'>();
    const byName = new Map<string, CatalogItemRow | 'dup'>();
    const put = (
      map: Map<string, CatalogItemRow | 'dup'>,
      key: string,
      item: CatalogItemRow,
    ): void => {
      const existing = map.get(key);
      if (!existing) map.set(key, item);
      else if (existing !== item) map.set(key, 'dup');
    };

    for (const item of items) {
      byId.set(item.id, item);
      const article = normalizeArticle(item.article);
      if (article) put(byArticle, article, item);
      const name = normalizeText(item.name);
      put(byName, name, item);
      put(byNameUnit, `${name}|${unitFamily(item.unit)}`, item);
    }
    return { byId, byArticle, byNameUnit, byName };
  }

  /** ID → артикул (если однозначен) → название + семейство единиц → название */
  private match(
    index: ItemIndex,
    row: ParsedPriceRow,
    unit: Unit | null,
  ): CatalogItemRow | null {
    if (row.id != null) {
      const byId = index.byId.get(row.id);
      if (byId) return byId;
    }
    const article = normalizeArticle(row.article);
    if (article) {
      const found = index.byArticle.get(article);
      if (found && found !== 'dup') return found;
    }
    const name = normalizeText(row.name);
    if (unit) {
      const found = index.byNameUnit.get(`${name}|${unitFamily(unit)}`);
      if (found && found !== 'dup') return found;
    }
    // Единица в файле другая — всё равно обновляем однозначную позицию:
    // иначе повторный импорт после исправления единицы создал бы дубль.
    const byName = index.byName.get(name);
    return byName && byName !== 'dup' ? byName : null;
  }

  private matchedBy(
    row: ParsedPriceRow,
    target: CatalogItemRow,
  ): 'id' | 'article' | 'name' {
    if (row.id != null && row.id === target.id) return 'id';
    const article = normalizeArticle(row.article);
    if (article && normalizeArticle(target.article) === article) return 'article';
    return 'name';
  }

  /** Применение: создаёт/обновляет позиции. Черновики — неактивные, с unitRaw */
  async commit(input: {
    catalogId: number;
    kind: PriceKind;
    userId: number;
    fileName: string | null;
    buffer: Buffer;
    overrides?: PriceUnitOverrides;
  }): Promise<PriceImportResult> {
    const preview = await this.preview(input);
    const access = await this.prices.assertCanEditCatalog(input.catalogId, input.userId);

    const toCreate = preview.rows.filter((r) => r.action === 'create');
    const toUpdate = preview.rows.filter((r) => r.action === 'update');
    if (toCreate.length === 0 && toUpdate.length === 0) {
      return {
        created: 0,
        updated: 0,
        unchanged: preview.stats.unchanged,
        drafts: 0,
        categoriesCreated: 0,
        message: 'Менять нечего: справочник уже совпадает с файлом.',
      };
    }

    const result = await this.prisma.$transaction(
      async (tx) => {
        const existing = await tx.priceCategory.findMany({
          where: { kind: input.kind, catalogId: input.catalogId },
          select: { id: true, name: true },
        });
        const categoryIds = new Map(existing.map((c) => [normalizeText(c.name), c.id]));
        let categoriesCreated = 0;

        for (const name of new Set(preview.rows.map((r) => r.category))) {
          const key = normalizeText(name);
          if (categoryIds.has(key)) continue;
          const max = await tx.priceCategory.aggregate({
            where: { kind: input.kind, catalogId: input.catalogId },
            _max: { sortOrder: true },
          });
          const created = await tx.priceCategory.create({
            data: {
              name: name.trim().slice(0, 120),
              kind: input.kind,
              // ⭐ №373 (B2): категория импорта живёт в этом справочнике
              catalogId: input.catalogId,
              sortOrder: (max._max.sortOrder ?? 0) + 1,
            },
            select: { id: true },
          });
          categoryIds.set(key, created.id);
          categoriesCreated += 1;
        }

        const requireCategory = (name: string): number => {
          const id = categoryIds.get(normalizeText(name));
          if (!id) throw new BadRequestException(`Категория «${name}» не найдена`);
          return id;
        };

        let updated = 0;
        for (const row of toUpdate) {
          // ⭐ №372 (P0): обновляем ТОЛЬКО позицию из этого справочника.
          // `row.id` — id из Excel-файла, его нельзя использовать для update:
          // подставив чужой id, можно было перезаписать расценку другого каталога.
          if (row.targetId == null) continue;
          const target = await tx.priceItem.findFirst({
            where: { id: row.targetId, catalogId: input.catalogId },
            select: { id: true },
          });
          if (!target) {
            throw new BadRequestException(
              `Строка ${row.row}: позиция больше не существует в этом справочнике — повторите предпросмотр`,
            );
          }
          const data: Prisma.PriceItemUncheckedUpdateInput = {
            name: row.name.trim(),
            article: row.article?.trim() || null,
            price: row.price ?? 0,
            categoryId: requireCategory(row.category),
          };
          if (row.unit) {
            data.unit = row.unit;
            data.unitRaw = row.unitRaw;
            data.needsClarification = false;
            data.isActive = true;
          }
          await tx.priceItem.update({ where: { id: target.id }, data });
          updated += 1;
        }

        const createData: Prisma.PriceItemUncheckedCreateInput[] = toCreate.map((row) => ({
          ownerId: access.catalog.ownerId,
          catalogId: input.catalogId,
          name: row.name.trim(),
          article: row.article?.trim() || null,
          unit: row.unit ?? Unit.PIECE,
          unitRaw: row.unitRaw,
          needsClarification: row.needsUnit,
          isActive: !row.needsUnit,
          createdById: input.userId,
          price: row.price ?? 0,
          categoryId: requireCategory(row.category),
          kind: input.kind,
        }));
        if (createData.length > 0) await tx.priceItem.createMany({ data: createData });

        return {
          created: createData.length,
          updated,
          categoriesCreated,
          drafts: createData.filter((d) => d.needsClarification).length,
        };
      },
      { timeout: 30_000 },
    );

    await this.audit.log(input.userId, 'price_catalog', input.catalogId, 'import', undefined, {
      kind: input.kind,
      fileName: input.fileName,
      ...result,
      unchanged: preview.stats.unchanged,
    });

    const parts = [
      result.created > 0 ? `добавлено ${result.created}` : null,
      result.updated > 0 ? `обновлено ${result.updated}` : null,
      result.drafts > 0 ? `черновиков ${result.drafts} (уточните единицу)` : null,
      preview.stats.unchanged > 0 ? `без изменений ${preview.stats.unchanged}` : null,
    ].filter((part): part is string => Boolean(part));

    return {
      ...result,
      unchanged: preview.stats.unchanged,
      message: parts.length > 0 ? `Импорт: ${parts.join(', ')}.` : 'Изменений нет.',
    };
  }

  /** Черновики импорта: единица не распознана, позиции неактивны */
  async listClarifications(catalogId: number, userId: number, kind?: PriceKind) {
    await this.prices.assertCanEditCatalog(catalogId, userId);
    const items = await this.prisma.priceItem.findMany({
      where: { catalogId, needsClarification: true, ...(kind ? { kind } : {}) },
      select: {
        id: true,
        name: true,
        price: true,
        unitRaw: true,
        kind: true,
        category: { select: { name: true } },
      },
      orderBy: [{ unitRaw: 'asc' }, { name: 'asc' }],
    });

    const groups = new Map<
      string,
      {
        raw: string;
        key: string;
        count: number;
        items: {
          id: number;
          name: string;
          price: number;
          category: string | null;
          kind: PriceKind;
        }[];
      }
    >();
    for (const item of items) {
      const key = unitKey(item.unitRaw);
      const group = groups.get(key) ?? { raw: item.unitRaw?.trim() ?? '', key, count: 0, items: [] };
      group.count += 1;
      group.items.push({
        id: item.id,
        name: item.name,
        price: Number(item.price),
        category: item.category?.name ?? null,
        kind: item.kind,
      });
      groups.set(key, group);
    }

    return { total: items.length, groups: [...groups.values()] };
  }

  /** Уточнение единицы: по группе сырого текста или по конкретным позициям */
  async resolveClarifications(
    catalogId: number,
    userId: number,
    input: { raw?: string; ids?: number[]; unit: Unit },
  ) {
    await this.prices.assertCanEditCatalog(catalogId, userId);
    const ids = (input.ids ?? []).filter((id) => Number.isInteger(id) && id > 0);
    if (ids.length === 0 && input.raw === undefined) {
      throw new BadRequestException('Укажите группу единицы или позиции');
    }

    const where: Prisma.PriceItemWhereInput = {
      catalogId,
      needsClarification: true,
      ...(ids.length > 0 ? { id: { in: ids } } : { unitRaw: input.raw ? input.raw : null }),
    };
    const updated = await this.prisma.priceItem.updateMany({
      where,
      data: { unit: input.unit, unitRaw: null, needsClarification: false, isActive: true },
    });

    await this.audit.log(
      userId,
      'price_catalog',
      catalogId,
      'clarify',
      { raw: input.raw ?? null, ids: ids.length > 0 ? ids : null },
      { unit: input.unit, updated: updated.count },
    );
    return { updated: updated.count };
  }
}





