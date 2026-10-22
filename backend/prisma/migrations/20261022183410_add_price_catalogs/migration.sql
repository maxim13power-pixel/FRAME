-- ⭐ №151: справочники цен (PriceCatalog) + привязка расценок и проектов.
-- Существующие данные переносятся этой же миграцией (backfill): общие расценки → «Демо-справочник»,
-- личные расценки → личный справочник владельца.

-- CreateTable
CREATE TABLE "price_catalogs" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "ownerId" INTEGER,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "price_catalogs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "price_catalogs_ownerId_idx" ON "price_catalogs"("ownerId");

-- AddForeignKey
ALTER TABLE "price_catalogs" ADD CONSTRAINT "price_catalogs_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable: сначала nullable — иначе существующие строки не дадут добавить колонку
ALTER TABLE "price_items" ADD COLUMN "catalogId" INTEGER;
ALTER TABLE "Project" ADD COLUMN "catalogId" INTEGER;

-- Backfill 1: системный справочник для общих расценок
INSERT INTO "price_catalogs" ("name", "ownerId", "updatedAt")
VALUES ('Демо-справочник', NULL, CURRENT_TIMESTAMP);

-- Backfill 2: личный справочник каждому владельцу личных расценок
INSERT INTO "price_catalogs" ("name", "ownerId", "updatedAt")
SELECT 'Личный справочник', u."id", CURRENT_TIMESTAMP
FROM "User" u
WHERE EXISTS (SELECT 1 FROM "price_items" pi WHERE pi."ownerId" = u."id");

-- Backfill 3: расставляем расценки по своим справочникам
UPDATE "price_items" pi
SET "catalogId" = c."id"
FROM "price_catalogs" c
WHERE c."ownerId" IS NOT DISTINCT FROM pi."ownerId";

-- Backfill 4: страховка — если что-то осталось без справочника, кладём в системный
UPDATE "price_items"
SET "catalogId" = (SELECT "id" FROM "price_catalogs" WHERE "ownerId" IS NULL ORDER BY "id" LIMIT 1)
WHERE "catalogId" IS NULL;

-- Теперь колонка обязательна
ALTER TABLE "price_items" ALTER COLUMN "catalogId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "price_items_catalogId_idx" ON "price_items"("catalogId");
CREATE INDEX "Project_catalogId_idx" ON "Project"("catalogId");

-- AddForeignKey
ALTER TABLE "price_items" ADD CONSTRAINT "price_items_catalogId_fkey" FOREIGN KEY ("catalogId") REFERENCES "price_catalogs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Project" ADD CONSTRAINT "Project_catalogId_fkey" FOREIGN KEY ("catalogId") REFERENCES "price_catalogs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
