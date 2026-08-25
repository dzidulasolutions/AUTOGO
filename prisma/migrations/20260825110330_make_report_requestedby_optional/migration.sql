-- DropForeignKey
ALTER TABLE "reports" DROP CONSTRAINT "reports_requestedById_fkey";

-- AlterTable
ALTER TABLE "reports" ALTER COLUMN "requestedById" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
