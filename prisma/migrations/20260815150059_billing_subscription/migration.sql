-- AlterTable
ALTER TABLE "Store" ADD COLUMN     "planActivatedAt" TIMESTAMP(3),
ADD COLUMN     "subscriptionId" TEXT,
ADD COLUMN     "subscriptionStatus" TEXT;
