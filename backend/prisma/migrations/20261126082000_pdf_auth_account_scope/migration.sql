-- ⭐ №406: квота и идемпотентность PDF-экспорта — по АККАУНТУ (владельцу объекта),
-- а не по тому, кто нажал «печать». Таблица на момент миграции содержит только тестовые
-- авторизации (они очищены), поэтому переносим её вручную и не теряем данные.
ALTER TABLE "pdf_export_authorizations" RENAME COLUMN "userId" TO "accountId";

ALTER TABLE "pdf_export_authorizations" ADD COLUMN "actorUserId" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "pdf_export_authorizations" ADD COLUMN "projectId" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "pdf_export_authorizations" ALTER COLUMN "actorUserId" DROP DEFAULT;
ALTER TABLE "pdf_export_authorizations" ALTER COLUMN "projectId" DROP DEFAULT;

DROP INDEX IF EXISTS "pdf_export_authorizations_userId_periodKey_payloadHash_key";
CREATE UNIQUE INDEX "pdf_export_authorizations_accountId_periodKey_payloadHash_key"
  ON "pdf_export_authorizations"("accountId", "periodKey", "payloadHash");

CREATE INDEX "pdf_export_authorizations_accountId_projectId_createdAt_idx"
  ON "pdf_export_authorizations"("accountId", "projectId", "createdAt");

ALTER TABLE "pdf_export_authorizations" DROP CONSTRAINT IF EXISTS "pdf_export_authorizations_userId_fkey";
ALTER TABLE "pdf_export_authorizations" ADD CONSTRAINT "pdf_export_authorizations_accountId_fkey"
  FOREIGN KEY ("accountId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
