-- ⭐ №246: отложенное безвозвратное удаление объекта (30 дней, отмена).
-- Поля ставит только администратор объекта; purge-задача чистит истёкшие.
ALTER TABLE "Object"
    ADD COLUMN "deleteRequestedAt" TIMESTAMP(3),
    ADD COLUMN "deleteAfter" TIMESTAMP(3),
    ADD COLUMN "deleteRequestedBy" INTEGER;

CREATE INDEX "Object_deleteAfter_idx" ON "Object"("deleteAfter");
