-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'STORE_MANAGER', 'FOREMAN', 'CUSTOMER');

-- CreateEnum
CREATE TYPE "PriceKind" AS ENUM ('WORK', 'MATERIAL');

-- CreateEnum
CREATE TYPE "Unit" AS ENUM ('PIECE', 'METER', 'SQUARE_METER', 'CUBIC_METER', 'KILOGRAM', 'LITER', 'TON', 'BAG', 'PACKAGE', 'SET');

-- CreateEnum
CREATE TYPE "AccessRole" AS ENUM ('CUSTOMER', 'FOREMAN', 'VIEWER');

-- CreateEnum
CREATE TYPE "ChangeStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "password" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'FOREMAN',
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
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Object_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "objectId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "note" TEXT,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
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
    "projectId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "materials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "material_fixes" (
    "id" SERIAL NOT NULL,
    "materialId" INTEGER NOT NULL,
    "amount" DECIMAL(14,3) NOT NULL,
    "note" TEXT,
    "fixedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" INTEGER,
    "isEdited" BOOLEAN NOT NULL DEFAULT false,
    "editedAt" TIMESTAMP(3),

    CONSTRAINT "material_fixes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_categories" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "kind" "PriceKind" NOT NULL DEFAULT 'WORK',

    CONSTRAINT "price_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_items" (
    "id" SERIAL NOT NULL,
    "ownerId" INTEGER,
    "name" TEXT NOT NULL,
    "article" TEXT,
    "unit" "Unit" NOT NULL DEFAULT 'PIECE',
    "price" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "categoryId" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "kind" "PriceKind" NOT NULL DEFAULT 'WORK',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "price_items_pkey" PRIMARY KEY ("id")
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "object_access_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "change_requests" (
    "id" SERIAL NOT NULL,
    "projectId" INTEGER NOT NULL,
    "materialId" INTEGER,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "ChangeStatus" NOT NULL DEFAULT 'PENDING',
    "proposedBy" INTEGER NOT NULL,
    "reviewedBy" INTEGER,
    "reviewComment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "change_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invite_tokens" (
    "id" SERIAL NOT NULL,
    "token" TEXT NOT NULL,
    "objectId" INTEGER NOT NULL,
    "createdBy" INTEGER NOT NULL,
    "role" "AccessRole" NOT NULL DEFAULT 'FOREMAN',
    "hidePrices" BOOLEAN NOT NULL DEFAULT false,
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
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rentals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE INDEX "Project_endDate_idx" ON "Project"("endDate");

-- CreateIndex
CREATE INDEX "Project_objectId_idx" ON "Project"("objectId");

-- CreateIndex
CREATE INDEX "materials_projectId_idx" ON "materials"("projectId");

-- CreateIndex
CREATE INDEX "material_fixes_fixedAt_idx" ON "material_fixes"("fixedAt");

-- CreateIndex
CREATE INDEX "material_fixes_materialId_fixedAt_idx" ON "material_fixes"("materialId", "fixedAt");

-- CreateIndex
CREATE UNIQUE INDEX "price_categories_name_kind_key" ON "price_categories"("name", "kind");

-- CreateIndex
CREATE INDEX "price_items_categoryId_ownerId_idx" ON "price_items"("categoryId", "ownerId");

-- CreateIndex
CREATE INDEX "object_access_objectId_idx" ON "object_access"("objectId");

-- CreateIndex
CREATE UNIQUE INDEX "object_access_userId_objectId_projectId_key" ON "object_access"("userId", "objectId", "projectId");

-- CreateIndex
CREATE INDEX "change_requests_projectId_createdAt_idx" ON "change_requests"("projectId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "invite_tokens_token_key" ON "invite_tokens"("token");

-- CreateIndex
CREATE INDEX "invite_tokens_objectId_idx" ON "invite_tokens"("objectId");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_token_key" ON "password_reset_tokens"("token");

-- CreateIndex
CREATE INDEX "password_reset_tokens_userId_idx" ON "password_reset_tokens"("userId");

-- CreateIndex
CREATE INDEX "rentals_userId_idx" ON "rentals"("userId");

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_objectId_fkey" FOREIGN KEY ("objectId") REFERENCES "Object"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "materials" ADD CONSTRAINT "materials_priceItemId_fkey" FOREIGN KEY ("priceItemId") REFERENCES "price_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "materials" ADD CONSTRAINT "materials_materialItemId_fkey" FOREIGN KEY ("materialItemId") REFERENCES "price_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "materials" ADD CONSTRAINT "materials_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_fixes" ADD CONSTRAINT "material_fixes_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "materials"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_items" ADD CONSTRAINT "price_items_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_items" ADD CONSTRAINT "price_items_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "price_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "object_access" ADD CONSTRAINT "object_access_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "object_access" ADD CONSTRAINT "object_access_objectId_fkey" FOREIGN KEY ("objectId") REFERENCES "Object"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "change_requests" ADD CONSTRAINT "change_requests_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "change_requests" ADD CONSTRAINT "change_requests_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "materials"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "change_requests" ADD CONSTRAINT "change_requests_proposedBy_fkey" FOREIGN KEY ("proposedBy") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "change_requests" ADD CONSTRAINT "change_requests_reviewedBy_fkey" FOREIGN KEY ("reviewedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invite_tokens" ADD CONSTRAINT "invite_tokens_objectId_fkey" FOREIGN KEY ("objectId") REFERENCES "Object"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invite_tokens" ADD CONSTRAINT "invite_tokens_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rentals" ADD CONSTRAINT "rentals_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

