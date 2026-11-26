-- CreateEnum
CREATE TYPE "PlanCode" AS ENUM ('FREE', 'FOREMAN', 'TEAM');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'PAST_DUE', 'FROZEN', 'CANCELED');

-- CreateEnum
CREATE TYPE "SubscriptionSource" AS ENUM ('MANUAL', 'GRANDFATHER', 'PAYMENT', 'PROMO');

-- CreateTable
CREATE TABLE "plans" (
    "code" "PlanCode" NOT NULL,
    "name" TEXT NOT NULL,
    "priceMonthly" INTEGER NOT NULL DEFAULT 0,
    "maxObjects" INTEGER NOT NULL,
    "maxRows" INTEGER NOT NULL,
    "maxPhotos" INTEGER,
    "maxStorageMb" INTEGER,
    "maxPdfPerMonth" INTEGER NOT NULL,
    "maxExportRows" INTEGER NOT NULL,
    "maxWriters" INTEGER NOT NULL DEFAULT 0,
    "maxViewers" INTEGER NOT NULL DEFAULT 0,
    "historyMonths" INTEGER NOT NULL DEFAULT 3,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "planCode" "PlanCode" NOT NULL DEFAULT 'FREE',
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "source" "SubscriptionSource" NOT NULL DEFAULT 'MANUAL',
    "periodEnd" TIMESTAMP(3),
    "grandfather" BOOLEAN NOT NULL DEFAULT false,
    "pdfUsed" INTEGER NOT NULL DEFAULT 0,
    "pdfPeriod" TEXT,
    "seatsPaid" INTEGER NOT NULL DEFAULT 0,
    "storageAddonMb" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_userId_key" ON "subscriptions"("userId");

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_planCode_fkey" FOREIGN KEY ("planCode") REFERENCES "plans"("code") ON DELETE RESTRICT ON UPDATE CASCADE;
