-- P1-5 (деплой/оптимизация): индексы для частых запросов доступа и списков.
-- Имена — по Prisma-конвенции (<table>_<columns>_idx).
-- Таблицы без @@map в schema.prisma сохраняют имя модели с заглавной буквы (Project).

-- ObjectAccess: поиск доступа по объекту (guard/сервисы резолвят по objectId)
CREATE INDEX "object_access_objectId_idx" ON "object_access"("objectId");

-- ChangeRequest: список согласований проекта по времени
CREATE INDEX "change_requests_projectId_createdAt_idx" ON "change_requests"("projectId", "createdAt");

-- PriceItem: выборка личного/общего справочника по категории и владельцу
CREATE INDEX "price_items_categoryId_ownerId_idx" ON "price_items"("categoryId", "ownerId");

-- Project: проекты объекта
CREATE INDEX "Project_objectId_idx" ON "Project"("objectId");

-- InviteToken: ссылки объекта
CREATE INDEX "invite_tokens_objectId_idx" ON "invite_tokens"("objectId");

-- PasswordResetToken: убираем дубль @@index([token]) — уникальный token уже покрыт
-- индексом UNIQUE (password_reset_tokens_token_key), второй btree-индекс лишний.
DROP INDEX "password_reset_tokens_token_idx";
