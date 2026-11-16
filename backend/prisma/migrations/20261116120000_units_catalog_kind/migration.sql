-- ⭐ №272 (§116): погонный метр, вид справочника, черновики импорта.
-- ВАЖНО: ALTER TYPE ... ADD VALUE в PostgreSQL 12+ разрешён в транзакции, но новое
-- значение нельзя использовать до коммита — поэтому в этой миграции только добавление.

ALTER TYPE "Unit" ADD VALUE IF NOT EXISTS 'LINEAR_METER';

-- Вид справочника: SYSTEM — образец (ownerId = null), USER — база пользователя
CREATE TYPE "PriceCatalogKind" AS ENUM ('SYSTEM', 'USER');

ALTER TABLE "price_catalogs" ADD COLUMN "kind" "PriceCatalogKind" NOT NULL DEFAULT 'USER';
ALTER TABLE "price_catalogs" ADD COLUMN "isDefault" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "price_catalogs" ADD COLUMN "templateId" INTEGER;
ALTER TABLE "price_catalogs" ADD COLUMN "templateVersion" INTEGER;

-- Все существующие справочники без владельца — образцы
UPDATE "price_catalogs" SET "kind" = 'SYSTEM' WHERE "ownerId" IS NULL;

-- Удаление пользователя не должно превращать его личную базу в общий образец
ALTER TABLE "price_catalogs" DROP CONSTRAINT IF EXISTS "price_catalogs_ownerId_fkey";
ALTER TABLE "price_catalogs" ADD CONSTRAINT "price_catalogs_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "price_catalogs_ownerId_isDefault_idx" ON "price_catalogs"("ownerId", "isDefault");

-- Черновики импорта прайса: единица не распознана — позиция неактивна и ждёт уточнения
ALTER TABLE "price_items" ADD COLUMN "unitRaw" TEXT;
ALTER TABLE "price_items" ADD COLUMN "needsClarification" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "price_items" ADD COLUMN "createdById" INTEGER;
ALTER TABLE "price_items" ADD COLUMN "sourceObjectId" INTEGER;

CREATE INDEX "price_items_catalogId_needsClarification_idx"
  ON "price_items"("catalogId", "needsClarification");
