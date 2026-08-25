-- AlterTable
ALTER TABLE "AlertSetting" ADD COLUMN     "profitAlertsEnabled" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "discountCodes" TEXT[],
ADD COLUMN     "shippingCharged" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "shippingCountry" TEXT,
ADD COLUMN     "shippingProvince" TEXT,
ADD COLUMN     "totalDiscounts" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "ProductVariant" ADD COLUMN     "unitCost" DECIMAL(12,2);

-- CreateTable
CREATE TABLE "CostSetting" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "shippingCostPerOrder" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "paymentFeePercent" DECIMAL(5,2) NOT NULL DEFAULT 2,
    "codRtoPercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "codRtoCostPerOrder" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "monthlyAdSpend" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "freeShippingThreshold" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "defaultMarginPercent" DECIMAL(5,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CostSetting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CostSetting_shopId_key" ON "CostSetting"("shopId");

-- AddForeignKey
ALTER TABLE "CostSetting" ADD CONSTRAINT "CostSetting_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
