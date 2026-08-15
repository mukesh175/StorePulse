-- AlterTable
ALTER TABLE "Store" ADD COLUMN     "refreshToken" TEXT,
ADD COLUMN     "refreshTokenExpiresAt" TIMESTAMP(3),
ADD COLUMN     "tokenExpiresAt" TIMESTAMP(3);
