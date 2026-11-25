-- CreateTable
CREATE TABLE "estimate_templates" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "ownerId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "estimate_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estimate_template_items" (
    "id" SERIAL NOT NULL,
    "templateId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "unit" "Unit" NOT NULL DEFAULT 'PIECE',
    "quantity" DECIMAL(14,3) NOT NULL,
    "unitPrice" DECIMAL(14,2) NOT NULL,
    "materialUnitPrice" DECIMAL(14,2) NOT NULL,
    "priceItemId" INTEGER,
    "materialItemId" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "estimate_template_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "estimate_templates_ownerId_idx" ON "estimate_templates"("ownerId");

-- CreateIndex
CREATE INDEX "estimate_template_items_templateId_idx" ON "estimate_template_items"("templateId");

-- AddForeignKey
ALTER TABLE "estimate_template_items" ADD CONSTRAINT "estimate_template_items_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "estimate_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
