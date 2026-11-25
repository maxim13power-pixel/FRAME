-- CreateTable
CREATE TABLE "object_templates" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "note" TEXT,
    "authorId" INTEGER NOT NULL,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "sourceObjectId" INTEGER,
    "sourceObjectName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "object_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "object_template_projects" (
    "id" SERIAL NOT NULL,
    "templateId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "note" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "object_template_projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "object_template_materials" (
    "id" SERIAL NOT NULL,
    "projectId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "article" TEXT,
    "unit" "Unit" NOT NULL DEFAULT 'PIECE',
    "specQuantity" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "note" TEXT,
    "priceItemId" INTEGER,
    "materialItemId" INTEGER,
    "unitPrice" DECIMAL(12,2),
    "materialUnitPrice" DECIMAL(12,2),

    CONSTRAINT "object_template_materials_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "object_templates_authorId_idx" ON "object_templates"("authorId");

-- CreateIndex
CREATE INDEX "object_templates_isPublic_idx" ON "object_templates"("isPublic");

-- CreateIndex
CREATE INDEX "object_template_projects_templateId_idx" ON "object_template_projects"("templateId");

-- CreateIndex
CREATE INDEX "object_template_materials_projectId_idx" ON "object_template_materials"("projectId");

-- AddForeignKey
ALTER TABLE "object_templates" ADD CONSTRAINT "object_templates_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "object_template_projects" ADD CONSTRAINT "object_template_projects_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "object_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "object_template_materials" ADD CONSTRAINT "object_template_materials_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "object_template_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

