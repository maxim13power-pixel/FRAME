-- ⭐ №164: справочник цен на уровне объекта (проект может перекрыть своим catalogId).
-- Данные не переносим: существующие объекты остаются без справочника (используется личный/системный).
ALTER TABLE "Object" ADD COLUMN "catalogId" INTEGER;

CREATE INDEX "Object_catalogId_idx" ON "Object"("catalogId");

ALTER TABLE "Object" ADD CONSTRAINT "Object_catalogId_fkey" FOREIGN KEY ("catalogId") REFERENCES "price_catalogs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
