-- CreateTable
CREATE TABLE "DataAccessLog" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "recordCount" INTEGER NOT NULL DEFAULT 0,
    "fields" TEXT[],
    "actor" TEXT NOT NULL DEFAULT 'MERCHANT',
    "context" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DataAccessLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DataAccessLog_shopId_createdAt_idx" ON "DataAccessLog"("shopId", "createdAt");

-- AddForeignKey
ALTER TABLE "DataAccessLog" ADD CONSTRAINT "DataAccessLog_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
