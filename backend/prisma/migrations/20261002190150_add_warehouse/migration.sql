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
    "createdBy" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "warehouse_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "warehouse_items_objectId_idx" ON "warehouse_items"("objectId");

-- CreateIndex
CREATE INDEX "warehouse_transactions_warehouseItemId_idx" ON "warehouse_transactions"("warehouseItemId");

-- CreateIndex
CREATE INDEX "warehouse_transactions_projectId_idx" ON "warehouse_transactions"("projectId");

-- AddForeignKey
ALTER TABLE "warehouse_items" ADD CONSTRAINT "warehouse_items_objectId_fkey" FOREIGN KEY ("objectId") REFERENCES "Object"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_transactions" ADD CONSTRAINT "warehouse_transactions_warehouseItemId_fkey" FOREIGN KEY ("warehouseItemId") REFERENCES "warehouse_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_transactions" ADD CONSTRAINT "warehouse_transactions_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
