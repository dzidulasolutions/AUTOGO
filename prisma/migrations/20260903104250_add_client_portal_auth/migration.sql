-- AlterTable
ALTER TABLE "clients" ADD COLUMN     "password" TEXT,
ADD COLUMN     "resetPasswordExpiresAt" TIMESTAMP(3),
ADD COLUMN     "resetPasswordToken" TEXT;
