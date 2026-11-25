-- ⭐ №249: личный архив проектов + отложенное удаление проекта.
CREATE TABLE "project_hidden" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "projectId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "project_hidden_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Project"
    ADD COLUMN "deleteRequestedAt" TIMESTAMP(3),
    ADD COLUMN "deleteAfter" TIMESTAMP(3),
    ADD COLUMN "deleteRequestedBy" INTEGER;

CREATE UNIQUE INDEX "project_hidden_userId_projectId_key"
    ON "project_hidden"("userId", "projectId");
CREATE INDEX "project_hidden_userId_idx" ON "project_hidden"("userId");
CREATE INDEX "Project_deleteAfter_idx" ON "Project"("deleteAfter");

ALTER TABLE "project_hidden"
    ADD CONSTRAINT "project_hidden_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "project_hidden"
    ADD CONSTRAINT "project_hidden_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
