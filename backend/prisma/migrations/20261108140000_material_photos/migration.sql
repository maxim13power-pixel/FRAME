-- ⭐ №227: фото-фиксация материалов.
-- Файлы лежат в хранилище (локальный volume / S3 за интерфейсом PhotoStorage),
-- в таблице — только ключи и метаданные.
CREATE TABLE "material_photos" (
    "id" SERIAL NOT NULL,
    "materialId" INTEGER NOT NULL,
    "fileName" TEXT NOT NULL,
    "thumbName" TEXT,
    "mimeType" TEXT NOT NULL DEFAULT 'image/jpeg',
    "sizeBytes" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "comment" VARCHAR(500),
    "createdById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "material_photos_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "material_photos_materialId_createdAt_idx"
    ON "material_photos"("materialId", "createdAt");

ALTER TABLE "material_photos"
    ADD CONSTRAINT "material_photos_materialId_fkey"
    FOREIGN KEY ("materialId") REFERENCES "materials"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
