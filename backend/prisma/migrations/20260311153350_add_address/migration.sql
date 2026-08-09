/*
  Warnings:

  - Added the required column `address` to the `Object` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Object" ADD COLUMN     "address" TEXT NOT NULL;
