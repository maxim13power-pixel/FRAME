-- №202 (RFC импорта сметы): партия импорта + провенанс строк сметы.

-- CreateTable
CREATE TABLE "import_batches" (
    "id" SERIAL NOT NULL,
    "projectId" INTEGER NOT NULL,
    "importedById" INTEGER NOT NULL,
    "fileName" TEXT,
    "fileHash" TEXT,
    "templateVersion" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'PREVIEW',
    "rowsTotal" INTEGER NOT NULL DEFAULT 0,
    "createdCount" INTEGER NOT NULL DEFAULT 0,
    "updatedCount" INTEGER NOT NULL DEFAULT 0,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "pricesCreated" INTEGER NOT NULL DEFAULT 0,
    "preview" JSONB,
    "report" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "committedAt" TIMESTAMP(3),

    CONSTRAINT "import_batches_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "materials"
    ADD COLUMN "importBatchId" INTEGER,
    ADD COLUMN "importRowNumber" INTEGER,
    ADD COLUMN "externalKey" VARCHAR(64);

-- CreateIndex
CREATE INDEX "import_batches_projectId_createdAt_idx" ON "import_batches"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "materials_projectId_importBatchId_idx" ON "materials"("projectId", "importBatchId");

-- CreateIndex (уникальность ключа импорта внутри проекта; NULL-ы не конфликтуют)
CREATE UNIQUE INDEX "materials_projectId_externalKey_key" ON "materials"("projectId", "externalKey");

-- AddForeignKey
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
