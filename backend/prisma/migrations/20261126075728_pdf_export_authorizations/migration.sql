-- CreateTable
CREATE TABLE "pdf_export_authorizations" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "periodKey" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pdf_export_authorizations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pdf_export_authorizations_userId_periodKey_payloadHash_key" ON "pdf_export_authorizations"("userId", "periodKey", "payloadHash");

-- AddForeignKey
ALTER TABLE "pdf_export_authorizations" ADD CONSTRAINT "pdf_export_authorizations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
