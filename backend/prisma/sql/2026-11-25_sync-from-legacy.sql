-- ⭐ №394: «догоняющий» SQL для базы, созданной СТАРЫМИ 28 миграциями
-- (prisma/migrations_legacy). Получен командой:
--   prisma migrate diff --from-url <старая_БД> --to-schema-datamodel prisma/schema.prisma --script
-- и проверен 25.11.2026 на пустой копии: после применения diff к schema.prisma пустой.
--
-- КОГДА НУЖЕН: только если целевая база собиралась legacy-миграциями (например, Railway
-- до baseline). Если база делалась через prisma db push (dev) или это restore дампа dev —
-- НЕ НУЖЕН, там diff уже пустой (см. docs/MIGRATIONS.md).
--
-- ПОРЯДОК: 1) убедиться, что diff вашей базы совпадает с этим файлом;
--          2) проверить дубли по (catalogId, name, kind) — иначе упадёт unique-индекс;
--          3) применить в транзакции; 4) prisma migrate resolve --applied 0_init.
-- Данные не теряются: все колонки nullable, индекс по (catalogId, name, kind) не мешает
-- строкам с catalogId IS NULL (в PostgreSQL NULL-ы в unique-индексе различаются).

-- DropIndex
DROP INDEX "price_categories_name_kind_key";

-- AlterTable
ALTER TABLE "material_fixes" ADD COLUMN     "materialUnitPrice" DECIMAL(14,2),
ADD COLUMN     "unitPrice" DECIMAL(14,2);

-- AlterTable
ALTER TABLE "price_categories" ADD COLUMN     "catalogId" INTEGER;

-- AlterTable
ALTER TABLE "rentals" ADD COLUMN     "closedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "price_categories_catalogId_idx" ON "price_categories"("catalogId");

-- CreateIndex
CREATE UNIQUE INDEX "price_categories_catalogId_name_kind_key" ON "price_categories"("catalogId", "name", "kind");

-- AddForeignKey
ALTER TABLE "price_categories" ADD CONSTRAINT "price_categories_catalogId_fkey" FOREIGN KEY ("catalogId") REFERENCES "price_catalogs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
