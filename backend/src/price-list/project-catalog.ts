// backend/src/price-list/project-catalog.ts
// ⭐ Поиск/создание расценки для строки сметы.
// ⭐ №274 (§117): справочник проекта — это ССЫЛКА на рабочую базу (см. working-catalog.ts),
// копий позиций больше нет.
import { PriceItem, PriceKind, Prisma, Unit } from '@prisma/client';
import { unitsInFamily } from '../imports/unit-normalizer'; // ⭐ №272: «м» и «пог. м» совместимы
import { ensureProjectCatalog } from './working-catalog';

export const DEFAULT_PRICE_CATEGORY = 'Разное';

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
      unit: { in: unitsInFamily(input.unit) },
    },
  });
  return (
    candidates.find((item) => norm(item.name) === norm(input.name)) ?? null
  );
}

/**
 * ⭐ №321: «в упаковке N единиц» можно задать прямо из сметы (калькулятор «от объёма»).
 * Пишем только положительное значение и только если оно отличается — иначе лишний UPDATE.
 */
async function applyPackSize(
  tx: Prisma.TransactionClient,
  item: PriceItem,
  packSize?: number | null,
): Promise<PriceItem> {
  const next = Number(packSize ?? 0);
  if (!(next > 0)) return item;
  if (Number(item.packSize ?? 0) === next) return item;
  return tx.priceItem.update({
    where: { id: item.id },
    data: { packSize: next },
  });
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
    /** ⭐ №321: сколько единиц в упаковке (кг/л/шт); null/0 — не трогаем */
    packSize?: number | null;
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
      return {
        item: await applyPackSize(tx, source, opts.packSize),
        catalogId,
        copied: false,
        priceUpdated: false,
      };
    }
    const existing = await findTargetItem(tx, catalogId, {
      name: source.name,
      article: source.article,
      unit: source.unit,
      kind: source.kind,
    });
    if (existing) {
      return {
        item: await applyPackSize(tx, existing, opts.packSize),
        catalogId,
        copied: false,
        priceUpdated: false,
      };
    }
    const copied = await tx.priceItem.create({
      data: {
        ownerId: catalog.ownerId,
        catalogId,
        name: source.name,
        article: source.article,
        unit: source.unit,
        price: source.price,
        // ⭐ №321: копия расценки сохраняет упаковку (раньше терялась)
        packSize: opts.packSize ?? source.packSize ?? null,
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
    const nextPackSize = Number(opts.packSize ?? 0);
    // ⭐ №321: упаковку сохраняем вместе с ценой (калькулятор «от объёма»)
    const packChanged =
      nextPackSize > 0 && Number(existing.packSize ?? 0) !== nextPackSize;
    const priceChanged =
      opts.updatePrice !== false &&
      Math.abs(Number(existing.price) - Number(opts.price)) >= 0.01;
    if (priceChanged || packChanged) {
      const updated = await tx.priceItem.update({
        where: { id: existing.id },
        data: {
          ...(priceChanged ? { price: opts.price, categoryId } : {}),
          ...(packChanged ? { packSize: nextPackSize } : {}),
        },
      });
      return {
        item: updated,
        catalogId,
        copied: false,
        priceUpdated: priceChanged,
      };
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
      // ⭐ №321: упаковка из калькулятора «от объёма» (null — цена за единицу)
      packSize: Number(opts.packSize ?? 0) > 0 ? Number(opts.packSize) : null,
      categoryId,
      kind: opts.kind,
      isActive: true,
    },
  });
  return { item: created, catalogId, copied: false, priceUpdated: false };
}
