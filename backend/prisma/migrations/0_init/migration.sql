-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'STORE_MANAGER', 'FOREMAN', 'CUSTOMER');

-- CreateEnum
CREATE TYPE "PriceKind" AS ENUM ('WORK', 'MATERIAL');

-- CreateEnum
CREATE TYPE "Unit" AS ENUM ('PIECE', 'METER', 'LINEAR_METER', 'SQUARE_METER', 'CUBIC_METER', 'KILOGRAM', 'LITER', 'TON', 'BAG', 'PACKAGE', 'SET');

-- CreateEnum
CREATE TYPE "PriceCatalogKind" AS ENUM ('SYSTEM', 'USER');

-- CreateEnum
CREATE TYPE "AccessRole" AS ENUM ('CUSTOMER', 'FOREMAN', 'VIEWER');

-- CreateEnum
CREATE TYPE "AccessRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AccessRequestKind" AS ENUM ('CREATE_PROJECTS');

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "password" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'FOREMAN',
    "tokenVersion" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Object" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "plannedEndDate" TIMESTAMP(3),
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "createdById" INTEGER,
    "catalogId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deleteRequestedAt" TIMESTAMP(3),
    "deleteAfter" TIMESTAMP(3),
    "deleteRequestedBy" INTEGER,

    CONSTRAINT "Object_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "objectId" INTEGER NOT NULL,
    "catalogId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "deleteRequestedAt" TIMESTAMP(3),
    "deleteAfter" TIMESTAMP(3),
    "deleteRequestedBy" INTEGER,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_hidden" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "projectId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_hidden_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "materials" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "article" TEXT,
    "unit" "Unit" NOT NULL DEFAULT 'PIECE',
    "specQuantity" DECIMAL(14,3) NOT NULL,
    "totalUsed" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "lastEntry" DECIMAL(14,3),
    "lastEntryDate" TIMESTAMP(3),
    "note" TEXT,
    "progressPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isSpecLocked" BOOLEAN NOT NULL DEFAULT true,
    "priceItemId" INTEGER,
    "unitPrice" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "totalCost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "materialItemId" INTEGER,
    "materialUnitPrice" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "materialTotalCost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "consumption" DOUBLE PRECISION,
    "projectId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "importBatchId" INTEGER,
    "importRowNumber" INTEGER,
    "externalKey" VARCHAR(64),

    CONSTRAINT "materials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "material_fixes" (
    "id" SERIAL NOT NULL,
    "materialId" INTEGER NOT NULL,
    "amount" DECIMAL(14,3) NOT NULL,
    "note" TEXT,
    "fixedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" INTEGER,
    "isEdited" BOOLEAN NOT NULL DEFAULT false,
    "editedAt" TIMESTAMP(3),
    "unitPrice" DECIMAL(14,2),
    "materialUnitPrice" DECIMAL(14,2),

    CONSTRAINT "material_fixes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

-- CreateTable
CREATE TABLE "price_categories" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "kind" "PriceKind" NOT NULL DEFAULT 'WORK',
    "catalogId" INTEGER,

    CONSTRAINT "price_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_items" (
    "id" SERIAL NOT NULL,
    "ownerId" INTEGER,
    "catalogId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "article" TEXT,
    "unit" "Unit" NOT NULL DEFAULT 'PIECE',
    "unitRaw" TEXT,
    "needsClarification" BOOLEAN NOT NULL DEFAULT false,
    "createdById" INTEGER,
    "sourceObjectId" INTEGER,
    "price" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "packSize" DOUBLE PRECISION,
    "categoryId" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "kind" "PriceKind" NOT NULL DEFAULT 'WORK',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "price_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_catalogs" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "ownerId" INTEGER,
    "kind" "PriceCatalogKind" NOT NULL DEFAULT 'USER',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "templateId" INTEGER,
    "templateVersion" INTEGER,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "price_catalogs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "object_access" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "objectId" INTEGER NOT NULL,
    "projectId" INTEGER,
    "role" "AccessRole" NOT NULL DEFAULT 'FOREMAN',
    "hidePrices" BOOLEAN NOT NULL DEFAULT false,
    "invitedBy" INTEGER,
    "canCreateProjects" BOOLEAN NOT NULL DEFAULT false,
    "isManager" BOOLEAN NOT NULL DEFAULT false,
    "isHidden" BOOLEAN NOT NULL DEFAULT false,
    "revokedAt" TIMESTAMP(3),
    "revokedById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "object_access_pkey" PRIMARY KEY ("id")
);

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

-- CreateTable
CREATE TABLE "invite_tokens" (
    "id" SERIAL NOT NULL,
    "token" TEXT NOT NULL,
    "objectId" INTEGER NOT NULL,
    "createdBy" INTEGER NOT NULL,
    "role" "AccessRole" NOT NULL DEFAULT 'FOREMAN',
    "hidePrices" BOOLEAN NOT NULL DEFAULT false,
    "canCreateProjects" BOOLEAN NOT NULL DEFAULT false,
    "projectId" INTEGER,
    "expiresAt" TIMESTAMP(3),
    "maxUses" INTEGER,
    "usesCount" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invite_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rentals" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT,
    "responsible" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "price" DECIMAL(14,2) NOT NULL,
    "totalSpent" DECIMAL(14,2) NOT NULL,
    "closedAt" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rentals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouse_items" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'шт',
    "category" TEXT,
    "quantity" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "price" DECIMAL(12,2),
    "comment" TEXT,
    "objectId" INTEGER,
    "createdBy" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "warehouse_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouse_transactions" (
    "id" SERIAL NOT NULL,
    "warehouseItemId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "quantity" DECIMAL(12,2) NOT NULL,
    "price" DECIMAL(12,2),
    "projectId" INTEGER,
    "comment" TEXT,
    "createdBy" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "warehouse_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reports" (
    "id" SERIAL NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "projectId" INTEGER NOT NULL,
    "objectId" INTEGER NOT NULL,
    "totalAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "comment" TEXT,
    "createdBy" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_items" (
    "id" SERIAL NOT NULL,
    "reportId" INTEGER NOT NULL,
    "materialId" INTEGER,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'шт',
    "quantity" DECIMAL(12,2) NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "report_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_tokens" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verification_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brigades" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "specialty" TEXT,
    "foremanName" TEXT,
    "phone" TEXT,
    "objectId" INTEGER,
    "comment" TEXT,
    "createdBy" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brigades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brigade_members" (
    "id" SERIAL NOT NULL,
    "brigadeId" INTEGER NOT NULL,
    "fullName" TEXT NOT NULL,
    "role" TEXT,
    "phone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "brigade_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brigade_shifts" (
    "id" SERIAL NOT NULL,
    "brigadeId" INTEGER NOT NULL,
    "projectId" INTEGER,
    "date" DATE NOT NULL,
    "hoursWorked" DECIMAL(5,2) NOT NULL,
    "outputValue" DECIMAL(12,2),
    "outputArea" DECIMAL(10,2),
    "comment" TEXT,
    "createdBy" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "brigade_shifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brigade_shift_members" (
    "id" SERIAL NOT NULL,
    "shiftId" INTEGER NOT NULL,
    "memberId" INTEGER,
    "fullName" TEXT NOT NULL,
    "hours" DECIMAL(5,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "brigade_shift_members_pkey" PRIMARY KEY ("id")
);

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

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" SERIAL NOT NULL,
    "actorId" INTEGER NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE INDEX "Object_catalogId_idx" ON "Object"("catalogId");

-- CreateIndex
CREATE INDEX "Object_deleteAfter_idx" ON "Object"("deleteAfter");

-- CreateIndex
CREATE INDEX "Project_endDate_idx" ON "Project"("endDate");

-- CreateIndex
CREATE INDEX "Project_objectId_idx" ON "Project"("objectId");

-- CreateIndex
CREATE INDEX "Project_catalogId_idx" ON "Project"("catalogId");

-- CreateIndex
CREATE INDEX "Project_deleteAfter_idx" ON "Project"("deleteAfter");

-- CreateIndex
CREATE INDEX "project_hidden_userId_idx" ON "project_hidden"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "project_hidden_userId_projectId_key" ON "project_hidden"("userId", "projectId");

-- CreateIndex
CREATE INDEX "materials_projectId_idx" ON "materials"("projectId");

-- CreateIndex
CREATE INDEX "materials_projectId_importBatchId_idx" ON "materials"("projectId", "importBatchId");

-- CreateIndex
CREATE UNIQUE INDEX "materials_projectId_externalKey_key" ON "materials"("projectId", "externalKey");

-- CreateIndex
CREATE INDEX "material_fixes_fixedAt_idx" ON "material_fixes"("fixedAt");

-- CreateIndex
CREATE INDEX "material_fixes_materialId_fixedAt_idx" ON "material_fixes"("materialId", "fixedAt");

-- CreateIndex
CREATE INDEX "material_photos_materialId_createdAt_idx" ON "material_photos"("materialId", "createdAt");

-- CreateIndex
CREATE INDEX "price_categories_catalogId_idx" ON "price_categories"("catalogId");

-- CreateIndex
CREATE UNIQUE INDEX "price_categories_catalogId_name_kind_key" ON "price_categories"("catalogId", "name", "kind");

-- CreateIndex
CREATE INDEX "price_items_categoryId_ownerId_idx" ON "price_items"("categoryId", "ownerId");

-- CreateIndex
CREATE INDEX "price_items_catalogId_idx" ON "price_items"("catalogId");

-- CreateIndex
CREATE INDEX "price_items_catalogId_needsClarification_idx" ON "price_items"("catalogId", "needsClarification");

-- CreateIndex
CREATE INDEX "price_catalogs_ownerId_idx" ON "price_catalogs"("ownerId");

-- CreateIndex
CREATE INDEX "price_catalogs_ownerId_isDefault_idx" ON "price_catalogs"("ownerId", "isDefault");

-- CreateIndex
CREATE INDEX "object_access_objectId_idx" ON "object_access"("objectId");

-- CreateIndex
CREATE INDEX "object_access_userId_isHidden_idx" ON "object_access"("userId", "isHidden");

-- CreateIndex
CREATE INDEX "access_requests_objectId_status_idx" ON "access_requests"("objectId", "status");

-- CreateIndex
CREATE INDEX "access_requests_requesterId_status_idx" ON "access_requests"("requesterId", "status");

-- CreateIndex
CREATE INDEX "object_templates_authorId_idx" ON "object_templates"("authorId");

-- CreateIndex
CREATE INDEX "object_templates_isPublic_idx" ON "object_templates"("isPublic");

-- CreateIndex
CREATE INDEX "object_template_projects_templateId_idx" ON "object_template_projects"("templateId");

-- CreateIndex
CREATE INDEX "object_template_materials_projectId_idx" ON "object_template_materials"("projectId");

-- CreateIndex
CREATE INDEX "import_batches_projectId_createdAt_idx" ON "import_batches"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "access_snapshots_userId_takenAt_idx" ON "access_snapshots"("userId", "takenAt");

-- CreateIndex
CREATE UNIQUE INDEX "invite_tokens_token_key" ON "invite_tokens"("token");

-- CreateIndex
CREATE INDEX "invite_tokens_objectId_idx" ON "invite_tokens"("objectId");

-- CreateIndex
CREATE INDEX "invite_tokens_projectId_idx" ON "invite_tokens"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_token_key" ON "password_reset_tokens"("token");

-- CreateIndex
CREATE INDEX "password_reset_tokens_userId_idx" ON "password_reset_tokens"("userId");

-- CreateIndex
CREATE INDEX "rentals_userId_idx" ON "rentals"("userId");

-- CreateIndex
CREATE INDEX "warehouse_items_objectId_idx" ON "warehouse_items"("objectId");

-- CreateIndex
CREATE INDEX "warehouse_items_createdBy_idx" ON "warehouse_items"("createdBy");

-- CreateIndex
CREATE INDEX "warehouse_transactions_warehouseItemId_idx" ON "warehouse_transactions"("warehouseItemId");

-- CreateIndex
CREATE INDEX "warehouse_transactions_projectId_idx" ON "warehouse_transactions"("projectId");

-- CreateIndex
CREATE INDEX "reports_projectId_idx" ON "reports"("projectId");

-- CreateIndex
CREATE INDEX "reports_objectId_idx" ON "reports"("objectId");

-- CreateIndex
CREATE INDEX "reports_status_idx" ON "reports"("status");

-- CreateIndex
CREATE INDEX "report_items_reportId_idx" ON "report_items"("reportId");

-- CreateIndex
CREATE INDEX "verification_tokens_email_idx" ON "verification_tokens"("email");

-- CreateIndex
CREATE INDEX "verification_tokens_code_idx" ON "verification_tokens"("code");

-- CreateIndex
CREATE INDEX "brigades_objectId_idx" ON "brigades"("objectId");

-- CreateIndex
CREATE INDEX "brigades_createdBy_idx" ON "brigades"("createdBy");

-- CreateIndex
CREATE INDEX "brigade_members_brigadeId_idx" ON "brigade_members"("brigadeId");

-- CreateIndex
CREATE INDEX "brigade_shifts_brigadeId_idx" ON "brigade_shifts"("brigadeId");

-- CreateIndex
CREATE INDEX "brigade_shifts_projectId_idx" ON "brigade_shifts"("projectId");

-- CreateIndex
CREATE INDEX "brigade_shifts_date_idx" ON "brigade_shifts"("date");

-- CreateIndex
CREATE INDEX "brigade_shift_members_shiftId_idx" ON "brigade_shift_members"("shiftId");

-- CreateIndex
CREATE INDEX "brigade_shift_members_memberId_idx" ON "brigade_shift_members"("memberId");

-- CreateIndex
CREATE INDEX "estimate_templates_ownerId_idx" ON "estimate_templates"("ownerId");

-- CreateIndex
CREATE INDEX "estimate_template_items_templateId_idx" ON "estimate_template_items"("templateId");

-- CreateIndex
CREATE INDEX "audit_logs_entity_entityId_idx" ON "audit_logs"("entity", "entityId");

-- CreateIndex
CREATE INDEX "audit_logs_actorId_createdAt_idx" ON "audit_logs"("actorId", "createdAt");

-- AddForeignKey
ALTER TABLE "Object" ADD CONSTRAINT "Object_catalogId_fkey" FOREIGN KEY ("catalogId") REFERENCES "price_catalogs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_objectId_fkey" FOREIGN KEY ("objectId") REFERENCES "Object"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_catalogId_fkey" FOREIGN KEY ("catalogId") REFERENCES "price_catalogs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_hidden" ADD CONSTRAINT "project_hidden_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_hidden" ADD CONSTRAINT "project_hidden_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "materials" ADD CONSTRAINT "materials_priceItemId_fkey" FOREIGN KEY ("priceItemId") REFERENCES "price_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "materials" ADD CONSTRAINT "materials_materialItemId_fkey" FOREIGN KEY ("materialItemId") REFERENCES "price_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "materials" ADD CONSTRAINT "materials_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_fixes" ADD CONSTRAINT "material_fixes_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "materials"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_photos" ADD CONSTRAINT "material_photos_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "materials"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_categories" ADD CONSTRAINT "price_categories_catalogId_fkey" FOREIGN KEY ("catalogId") REFERENCES "price_catalogs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_items" ADD CONSTRAINT "price_items_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_items" ADD CONSTRAINT "price_items_catalogId_fkey" FOREIGN KEY ("catalogId") REFERENCES "price_catalogs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_items" ADD CONSTRAINT "price_items_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "price_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_catalogs" ADD CONSTRAINT "price_catalogs_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "object_access" ADD CONSTRAINT "object_access_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "object_access" ADD CONSTRAINT "object_access_objectId_fkey" FOREIGN KEY ("objectId") REFERENCES "Object"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_requests" ADD CONSTRAINT "access_requests_objectId_fkey" FOREIGN KEY ("objectId") REFERENCES "Object"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_requests" ADD CONSTRAINT "access_requests_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_requests" ADD CONSTRAINT "access_requests_reviewedBy_fkey" FOREIGN KEY ("reviewedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "object_templates" ADD CONSTRAINT "object_templates_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "object_template_projects" ADD CONSTRAINT "object_template_projects_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "object_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "object_template_materials" ADD CONSTRAINT "object_template_materials_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "object_template_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_snapshots" ADD CONSTRAINT "access_snapshots_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invite_tokens" ADD CONSTRAINT "invite_tokens_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invite_tokens" ADD CONSTRAINT "invite_tokens_objectId_fkey" FOREIGN KEY ("objectId") REFERENCES "Object"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invite_tokens" ADD CONSTRAINT "invite_tokens_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rentals" ADD CONSTRAINT "rentals_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_items" ADD CONSTRAINT "warehouse_items_objectId_fkey" FOREIGN KEY ("objectId") REFERENCES "Object"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_transactions" ADD CONSTRAINT "warehouse_transactions_warehouseItemId_fkey" FOREIGN KEY ("warehouseItemId") REFERENCES "warehouse_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_transactions" ADD CONSTRAINT "warehouse_transactions_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_objectId_fkey" FOREIGN KEY ("objectId") REFERENCES "Object"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_items" ADD CONSTRAINT "report_items_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_items" ADD CONSTRAINT "report_items_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "price_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brigades" ADD CONSTRAINT "brigades_objectId_fkey" FOREIGN KEY ("objectId") REFERENCES "Object"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brigade_members" ADD CONSTRAINT "brigade_members_brigadeId_fkey" FOREIGN KEY ("brigadeId") REFERENCES "brigades"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brigade_shifts" ADD CONSTRAINT "brigade_shifts_brigadeId_fkey" FOREIGN KEY ("brigadeId") REFERENCES "brigades"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brigade_shifts" ADD CONSTRAINT "brigade_shifts_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brigade_shift_members" ADD CONSTRAINT "brigade_shift_members_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "brigade_shifts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brigade_shift_members" ADD CONSTRAINT "brigade_shift_members_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "brigade_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimate_template_items" ADD CONSTRAINT "estimate_template_items_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "estimate_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

