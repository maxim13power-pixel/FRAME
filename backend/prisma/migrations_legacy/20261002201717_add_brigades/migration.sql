-- CreateTable
CREATE TABLE "brigades" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "specialty" TEXT,
    "foremanName" TEXT,
    "phone" TEXT,
    "objectId" INTEGER,
    "comment" TEXT,
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
    "createdBy" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "brigade_shifts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "brigades_objectId_idx" ON "brigades"("objectId");

-- CreateIndex
CREATE INDEX "brigade_members_brigadeId_idx" ON "brigade_members"("brigadeId");

-- CreateIndex
CREATE INDEX "brigade_shifts_brigadeId_idx" ON "brigade_shifts"("brigadeId");

-- CreateIndex
CREATE INDEX "brigade_shifts_projectId_idx" ON "brigade_shifts"("projectId");

-- CreateIndex
CREATE INDEX "brigade_shifts_date_idx" ON "brigade_shifts"("date");

-- AddForeignKey
ALTER TABLE "brigades" ADD CONSTRAINT "brigades_objectId_fkey" FOREIGN KEY ("objectId") REFERENCES "Object"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brigade_members" ADD CONSTRAINT "brigade_members_brigadeId_fkey" FOREIGN KEY ("brigadeId") REFERENCES "brigades"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brigade_shifts" ADD CONSTRAINT "brigade_shifts_brigadeId_fkey" FOREIGN KEY ("brigadeId") REFERENCES "brigades"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brigade_shifts" ADD CONSTRAINT "brigade_shifts_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
