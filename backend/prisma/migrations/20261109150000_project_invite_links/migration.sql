-- ⭐ №250: ссылка-приглашение может вести в конкретный проект.
ALTER TABLE "invite_tokens" ADD COLUMN "projectId" INTEGER;
CREATE INDEX "invite_tokens_projectId_idx" ON "invite_tokens"("projectId");
ALTER TABLE "invite_tokens"
    ADD CONSTRAINT "invite_tokens_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
