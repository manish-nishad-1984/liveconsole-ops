-- DropForeignKey
ALTER TABLE "expenses" DROP CONSTRAINT "expenses_siteId_fkey";

-- AlterTable
ALTER TABLE "expenses" ALTER COLUMN "siteId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

