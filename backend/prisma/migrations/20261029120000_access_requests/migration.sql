-- ⭐ №178: заявки на право создавать проекты в объекте

-- CreateEnum
CREATE TYPE "AccessRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AccessRequestKind" AS ENUM ('CREATE_PROJECTS');

-- CreateTable
CREATE TABLE "access_requests" (
    "id" SERIAL NOT NULL,
    "objectId" INTEGER NOT NULL,
    "requesterId" INTEGER NOT NULL,
    "kind" "AccessRequestKind" NOT NULL DEFAULT 'CREATE_PROJECTS',
    "comment" TEXT,
    "status" "AccessRequestStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedBy" INTEGER,
    "reviewComment" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "access_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "access_requests_objectId_status_idx" ON "access_requests"("objectId", "status");

-- CreateIndex
CREATE INDEX "access_requests_requesterId_status_idx" ON "access_requests"("requesterId", "status");

-- ⭐ №178: одна АКТИВНАЯ заявка на (объект, заявитель, вид).
-- Частичный уникальный индекс, потому что история заявок должна сохраняться
-- (после отказа можно подать новую).
CREATE UNIQUE INDEX "access_requests_pending_unique"
  ON "access_requests"("objectId", "requesterId", "kind")
  WHERE "status" = 'PENDING';

-- AddForeignKey
ALTER TABLE "access_requests" ADD CONSTRAINT "access_requests_objectId_fkey" FOREIGN KEY ("objectId") REFERENCES "Object"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_requests" ADD CONSTRAINT "access_requests_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_requests" ADD CONSTRAINT "access_requests_reviewedBy_fkey" FOREIGN KEY ("reviewedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
