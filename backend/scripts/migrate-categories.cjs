// ⭐ №373 (B2): миграция категорий — из глобальных в категории справочника.
// Для каждого НЕ-системного справочника копируем категории, которые используют
// его расценки, и перенаправляем расценки на копии. Системные категории
// (catalogId = null) остаются эталоном для новых копий.
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env');
const env = fs.readFileSync(envPath, 'utf8');
process.env.DATABASE_URL = env.match(/DATABASE_URL\s*=\s*"?([^"\r\n]+)/)[1].trim();

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const catalogs = await prisma.priceCatalog.findMany({
    where: { kind: { not: 'SYSTEM' } },
    select: { id: true, name: true },
  });

  let created = 0;
  let moved = 0;

  for (const catalog of catalogs) {
    const items = await prisma.priceItem.findMany({
      where: { catalogId: catalog.id },
      select: { id: true, categoryId: true },
    });
    const categoryIds = [...new Set(items.map((i) => i.categoryId).filter((id) => id != null))];
    if (categoryIds.length === 0) continue;

    const categories = await prisma.priceCategory.findMany({
      where: { id: { in: categoryIds } },
    });
    const map = new Map();
    for (const category of categories) {
      // Уже своя категория этого справочника — не копируем
      if (category.catalogId === catalog.id) {
        map.set(category.id, category.id);
        continue;
      }
      const existing = await prisma.priceCategory.findFirst({
        where: {
          catalogId: catalog.id,
          name: category.name,
          kind: category.kind,
        },
        select: { id: true },
      });
      const copy =
        existing ??
        (await prisma.priceCategory.create({
          data: {
            name: category.name,
            sortOrder: category.sortOrder,
            kind: category.kind,
            catalogId: catalog.id,
          },
          select: { id: true },
        }));
      if (!existing) created += 1;
      map.set(category.id, copy.id);
    }

    for (const item of items) {
      if (item.categoryId == null) continue;
      const next = map.get(item.categoryId);
      if (next == null || next === item.categoryId) continue;
      await prisma.priceItem.update({
        where: { id: item.id },
        data: { categoryId: next },
      });
      moved += 1;
    }
    console.log(`справочник ${catalog.id} «${catalog.name}»: категорий ${map.size}, расценок ${items.length}`);
  }

  console.log(`Готово: создано категорий ${created}, перенесено расценок ${moved}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
