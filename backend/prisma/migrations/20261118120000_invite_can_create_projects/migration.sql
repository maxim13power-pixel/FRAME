-- ⭐ №303: «разрешить создавать проекты» прямо в ссылке-приглашении
-- (раньше флаг был только у прямой выдачи доступа по email/телефону).
ALTER TABLE "invite_tokens"
ADD COLUMN "canCreateProjects" BOOLEAN NOT NULL DEFAULT false;
