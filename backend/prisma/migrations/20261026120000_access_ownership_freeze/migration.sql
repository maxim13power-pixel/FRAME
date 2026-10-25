-- ⭐ №168: владение объектом, личный архив, мягкий отзыв доступа.
-- Срез не удаляет данные: отзыв доступа = «заморозка» (read-only) + снимок в шаблонах.

-- 1) Дубликаты ObjectAccess до включения уникального индекса.
-- Старый @@unique([userId, objectId, projectId]) не работал для projectId = NULL
-- (в Postgres NULL != NULL), поэтому дубли «доступ на весь объект» могли накопиться.
DELETE FROM "object_access" a
USING "object_access" b
WHERE a."id" > b."id"
  AND a."userId" = b."userId"
  AND a."objectId" = b."objectId"
  AND COALESCE(a."projectId", 0) = COALESCE(b."projectId", 0);

-- 2) Старый уникальный ключ → частичный NULL-safe индекс
ALTER TABLE "object_access" DROP CONSTRAINT IF EXISTS "object_access_userId_objectId_projectId_key";
DROP INDEX IF EXISTS "object_access_userId_objectId_projectId_key";
CREATE UNIQUE INDEX IF NOT EXISTS "object_access_user_object_project_key"
  ON "object_access" ("userId", "objectId", COALESCE("projectId", 0));

-- 3) Новые поля доступа: управление командой, личный архив, отзыв
ALTER TABLE "object_access" ADD COLUMN IF NOT EXISTS "isManager" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "object_access" ADD COLUMN IF NOT EXISTS "isHidden" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "object_access" ADD COLUMN IF NOT EXISTS "revokedAt" TIMESTAMP(3);
ALTER TABLE "object_access" ADD COLUMN IF NOT EXISTS "revokedById" INTEGER;

CREATE INDEX IF NOT EXISTS "object_access_userId_isHidden_idx"
  ON "object_access" ("userId", "isHidden");

-- 3.1) Legacy-прорабы с доступом на весь объект становятся менеджерами:
-- иначе после среза они потеряли бы возможность собирать команду.
UPDATE "object_access"
SET "isManager" = true
WHERE "role" = 'FOREMAN' AND "projectId" IS NULL;

-- 4) Автор объекта — только метка в карточке (права по-прежнему у ObjectAccess).
ALTER TABLE "Object" ADD COLUMN IF NOT EXISTS "createdById" INTEGER;

-- backfill: первый заказчик объекта, иначе любой участник
UPDATE "Object" o
SET "createdById" = sub."userId"
FROM (
  SELECT DISTINCT ON ("objectId") "objectId", "userId"
  FROM "object_access"
  ORDER BY "objectId", (CASE WHEN "role" = 'CUSTOMER' THEN 0 ELSE 1 END), "id" ASC
) sub
WHERE o."id" = sub."objectId" AND o."createdById" IS NULL;

-- 5) Авторы записей могут быть обезличены (152-ФЗ: deleteMe без потери данных)
ALTER TABLE "reports" ALTER COLUMN "createdBy" DROP NOT NULL;
ALTER TABLE "warehouse_transactions" ALTER COLUMN "createdBy" DROP NOT NULL;
ALTER TABLE "brigade_shifts" ALTER COLUMN "createdBy" DROP NOT NULL;

-- 6) Глобальный архив объектов отменён: архив стал личным (ObjectAccess.isHidden).
UPDATE "Object" SET "isArchived" = false WHERE "isArchived" = true;
