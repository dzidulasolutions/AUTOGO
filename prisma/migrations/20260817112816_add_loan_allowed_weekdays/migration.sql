-- AlterTable
ALTER TABLE "loans" ADD COLUMN     "allowedWeekdays" INTEGER[] DEFAULT ARRAY[1, 2, 3, 4, 5]::INTEGER[];
