-- ⭐ №207: право создавать проекты в объекте вместо «прораба-менеджера»
ALTER TABLE "object_access" ADD COLUMN "canCreateProjects" BOOLEAN NOT NULL DEFAULT false;

-- Перенос смысла: у кого был isManager (мог создавать проекты) — выдаём право.
UPDATE "object_access" SET "canCreateProjects" = true WHERE "isManager" = true;
