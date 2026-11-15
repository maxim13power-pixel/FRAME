// backend/src/price-list/project-catalog.ts
// ⭐ Справочник проекта — единственная рабочая база цен проекта.
// Каталоги цен (демо/личный/общий) — только библиотеки-источники; при создании
// проекта их активные позиции КОПИРУЮТСЯ в новый справочник проекта.
import { PriceCatalog, PriceItem, PriceKind, Prisma, Unit } from '@prisma/client';

export const PROJECT_CATALOG_PREFIX = 'Справочник проекта';
export const DEFAULT_PRICE_CATEGORY = 'Разное';

export function projectCatalogName(projectName: string): string {
  const name = projectName.trim() || 'Проект';
  return `${PROJECT_CATALOG_PREFIX} «${name.slice(0, 60)}»`;
}

/** Создать отдельный справочник проекта (owner = создатель проекта). */
export async function createProjectCatalog(
  tx: Prisma.TransactionClient,
  opts: {
    projectName: string;
    ownerId: number;
    sourceCatalogId?: number | null;
  },
): Promise<PriceCatalog> {
  const catalog = await tx.priceCatalog.create({
    data: {
      name: projectCatalogName(opts.projectName),
      ownerId: opts.ownerId,
    },
  });

  if (opts.sourceCatalogId) {
    const source = await tx.priceCatalog.findUnique({
      where: { id: opts.sourceCatalogId },
      include: { items: { where: { isActive: true } } },
    });
    if (source && source.items.length > 0) {
      await tx.priceItem.createMany({
        data: source.items.map((item) => ({
          ownerId: opts.ownerId,
          catalogId: catalog.id,
          name: item.name,
          article: item.article,
          unit: item.unit,
          price: item.price,
          categoryId: item.categoryId,
          kind: item.kind,
          isActive: true,
        })),
      });
    }
  }
  return catalog;
}

/** Копия каталога с картой «старый Item.id → новый Item.id» (для копии объекта). */
export async function copyCatalogWithMap(
  tx: Prisma.TransactionClient,
  opts: {
    projectName: string;
    ownerId: number;
    sourceCatalogId?: number | null;
  },
): Promise<{ catalog: PriceCatalog; idMap: Map<number, number> }> {
  const catalog = await tx.priceCatalog.create({
    data: { name: projectCatalogName(opts.projectName), ownerId: opts.ownerId },
  });
  const idMap = new Map<number, number>();
  if (opts.sourceCatalogId) {
    const sourceItems = await tx.priceItem.findMany({
      where: { catalogId: opts.sourceCatalogId, isActive: true },
    });
    for (const item of sourceItems) {
      const created = await tx.priceItem.create({
        data: {
          ownerId: opts.ownerId,
          catalogId: catalog.id,
          name: item.name,
          article: item.article,
          unit: item.unit,
          price: item.price,
          categoryId: item.categoryId,
          kind: item.kind,
          isActive: true,
        },
        select: { id: true },
      });
      idMap.set(item.id, created.id);
    }
  }
  return { catalog, idMap };
}

/** Старый проект без своего справочника (переходный период). */
export async function ensureProjectCatalog(
  tx: Prisma.TransactionClient,
  projectId: number,
  userId: number,
): Promise<{ id: number; name: string; ownerId: number | null }> {
  const project = await tx.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      name: true,
      catalogId: true,
      catalog: { select: { id: true, name: true, ownerId: true } },
    },
  });
  if (!project) throw new Error('Проект не найден');
  if (project.catalog) return project.catalog;

  const catalog = await createProjectCatalog(tx, {
    projectName: project.name,
    ownerId: userId,
  });
  await tx.project.update({
    where: { id: projectId },
    data: { catalogId: catalog.id },
  });
  return { id: catalog.id, name: catalog.name, ownerId: catalog.ownerId };
}

const norm = (value?: string | null) =>
  (value ?? '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[«»"'`]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

async function defaultCategory(
  tx: Prisma.TransactionClient,
  kind: PriceKind,
): Promise<number> {
  const category = await tx.priceCategory.upsert({
    where: {
      name_kind: { name: DEFAULT_PRICE_CATEGORY, kind },
    },
    update: {},
    create: {
      name: DEFAULT_PRICE_CATEGORY,
      kind,
      sortOrder: 999,
    },
    select: { id: true },
  });
  return category.id;
}

async function findTargetItem(
  tx: Prisma.TransactionClient,
  catalogId: number,
  input: {
    name: string;
    article?: string | null;
    unit: Unit;
    kind: PriceKind;
  },
): Promise<PriceItem | null> {
  const article = norm(input.article);
  if (article) {
    const byArticle = await tx.priceItem.findFirst({
      where: {
        catalogId,
        kind: input.kind,
        isActive: true,
        article: { equals: input.article!.trim(), mode: 'insensitive' },
      },
    });
    if (byArticle) return byArticle;
  }
  const candidates = await tx.priceItem.findMany({
    where: {
      catalogId,
      kind: input.kind,
      isActive: true,
      unit: input.unit,
    },
  });
  return candidates.find((item) => norm(item.name) === norm(input.name)) ?? null;
}

/**
 * Найти/создать позицию в справочнике проекта.
 *  • itemId — выбрана готовая расценка (можно из другого каталога) → копируем;
 *  • без itemId — цена введена в смете → создаём/обновляем позицию проекта.
 */
export async function resolveProjectPriceItem(
  tx: Prisma.TransactionClient,
  opts: {
    projectId: number;
    userId: number;
    itemId?: number | null;
    name: string;
    article?: string | null;
    unit: Unit;
    price: number;
    kind: PriceKind;
    categoryId?: number | null;
    /** true — при совпадении обновить цену в справочнике проекта */
    updatePrice?: boolean;
  },
): Promise<{
  item: PriceItem;
  catalogId: number;
  copied: boolean;
  priceUpdated: boolean;
}> {
  const catalog = await ensureProjectCatalog(tx, opts.projectId, opts.userId);
  const catalogId = catalog.id;

  if (opts.itemId != null) {
    const source = await tx.priceItem.findUnique({
      where: { id: opts.itemId },
    });
    if (!source || !source.isActive || source.kind !== opts.kind) {
      throw new Error('Расценка не найдена или неактивна');
    }
    if (source.catalogId === catalogId) {
      return { item: source, catalogId, copied: false, priceUpdated: false };
    }
    const existing = await findTargetItem(tx, catalogId, {
      name: source.name,
      article: source.article,
      unit: source.unit,
      kind: source.kind,
    });
    if (existing) {
      return { item: existing, catalogId, copied: false, priceUpdated: false };
    }
    const copied = await tx.priceItem.create({
      data: {
        ownerId: catalog.ownerId,
        catalogId,
        name: source.name,
        article: source.article,
        unit: source.unit,
        price: source.price,
        categoryId: source.categoryId,
        kind: source.kind,
        isActive: true,
      },
    });
    return { item: copied, catalogId, copied: true, priceUpdated: false };
  }

  const categoryId = opts.categoryId ?? (await defaultCategory(tx, opts.kind));
  const existing = await findTargetItem(tx, catalogId, {
    name: opts.name,
    article: opts.article,
    unit: opts.unit,
    kind: opts.kind,
  });
  if (existing) {
    if (
      opts.updatePrice !== false &&
      Math.abs(Number(existing.price) - Number(opts.price)) >= 0.01
    ) {
      const updated = await tx.priceItem.update({
        where: { id: existing.id },
        data: { price: opts.price, categoryId },
      });
      return { item: updated, catalogId, copied: false, priceUpdated: true };
    }
    return { item: existing, catalogId, copied: false, priceUpdated: false };
  }

  const created = await tx.priceItem.create({
    data: {
      ownerId: catalog.ownerId,
      catalogId,
      name: opts.name.trim(),
      article: opts.article?.trim() || null,
      unit: opts.unit,
      price: opts.price,
      categoryId,
      kind: opts.kind,
      isActive: true,
    },
  });
  return { item: created, catalogId, copied: false, priceUpdated: false };
}
