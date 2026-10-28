-- №204 (A#2): владелец «общих» сущностей без объекта.
-- createdBy=NULL остаётся у легаси-строк: они продолжают быть общими (демо не ломаем).

-- AlterTable
ALTER TABLE "warehouse_items" ADD COLUMN "createdBy" INTEGER;

-- AlterTable
ALTER TABLE "brigades" ADD COLUMN "createdBy" INTEGER;

-- CreateIndex
CREATE INDEX "warehouse_items_createdBy_idx" ON "warehouse_items"("createdBy");

-- CreateIndex
CREATE INDEX "brigades_createdBy_idx" ON "brigades"("createdBy");
