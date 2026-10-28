-- №194 (F1 шаг 2): неизменяемый снимок доступа, создаётся при отзыве.
-- CreateTable
CREATE TABLE "access_snapshots" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "objectId" INTEGER NOT NULL,
    "accessId" INTEGER,
    "objectName" TEXT NOT NULL,
    "projectId" INTEGER,
    "projectName" TEXT,
    "role" TEXT NOT NULL,
    "hidePrices" BOOLEAN NOT NULL DEFAULT false,
    "takenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedBy" INTEGER,
    "summary" JSONB NOT NULL,
    "payload" JSONB NOT NULL,

    CONSTRAINT "access_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "access_snapshots_userId_takenAt_idx" ON "access_snapshots"("userId", "takenAt");

-- AddForeignKey
ALTER TABLE "access_snapshots" ADD CONSTRAINT "access_snapshots_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
