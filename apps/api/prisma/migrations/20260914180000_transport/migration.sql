-- CreateEnum
CREATE TYPE "RentBasis" AS ENUM ('PER_DAY', 'FIXED');

-- CreateEnum
CREATE TYPE "RentPaymentSource" AS ENUM ('OFFICE', 'PETTY_CASH');

-- CreateTable
CREATE TABLE "vehicle_rentals" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "rentalNo" TEXT NOT NULL,
    "employeeId" UUID NOT NULL,
    "siteId" UUID,
    "vehicleType" TEXT NOT NULL,
    "vehicleNumber" TEXT,
    "vendorName" TEXT NOT NULL,
    "vendorMobile" TEXT,
    "driverName" TEXT,
    "driverMobile" TEXT,
    "fromDate" DATE NOT NULL,
    "toDate" DATE,
    "rentBasis" "RentBasis" NOT NULL DEFAULT 'PER_DAY',
    "rate" DECIMAL(12,2) NOT NULL,
    "extraCharges" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" UUID,
    "updatedById" UUID,

    CONSTRAINT "vehicle_rentals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicle_rent_payments" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "rentalId" UUID NOT NULL,
    "paymentDate" DATE NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "paymentMode" "PaymentMode" NOT NULL DEFAULT 'CASH',
    "source" "RentPaymentSource" NOT NULL DEFAULT 'OFFICE',
    "paidById" UUID NOT NULL,
    "referenceNo" TEXT,
    "notes" TEXT,
    "expenseId" UUID,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" UUID,
    "updatedById" UUID,

    CONSTRAINT "vehicle_rent_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "vehicle_rentals_organizationId_employeeId_idx" ON "vehicle_rentals"("organizationId", "employeeId");

-- CreateIndex
CREATE INDEX "vehicle_rentals_organizationId_fromDate_idx" ON "vehicle_rentals"("organizationId", "fromDate");

-- CreateIndex
CREATE INDEX "vehicle_rentals_siteId_idx" ON "vehicle_rentals"("siteId");

-- CreateIndex
CREATE UNIQUE INDEX "vehicle_rentals_organizationId_rentalNo_key" ON "vehicle_rentals"("organizationId", "rentalNo");

-- CreateIndex
CREATE UNIQUE INDEX "vehicle_rent_payments_expenseId_key" ON "vehicle_rent_payments"("expenseId");

-- CreateIndex
CREATE INDEX "vehicle_rent_payments_organizationId_idx" ON "vehicle_rent_payments"("organizationId");

-- CreateIndex
CREATE INDEX "vehicle_rent_payments_rentalId_idx" ON "vehicle_rent_payments"("rentalId");

-- CreateIndex
CREATE INDEX "vehicle_rent_payments_paidById_idx" ON "vehicle_rent_payments"("paidById");

-- AddForeignKey
ALTER TABLE "vehicle_rentals" ADD CONSTRAINT "vehicle_rentals_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_rentals" ADD CONSTRAINT "vehicle_rentals_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_rentals" ADD CONSTRAINT "vehicle_rentals_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_rent_payments" ADD CONSTRAINT "vehicle_rent_payments_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_rent_payments" ADD CONSTRAINT "vehicle_rent_payments_rentalId_fkey" FOREIGN KEY ("rentalId") REFERENCES "vehicle_rentals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_rent_payments" ADD CONSTRAINT "vehicle_rent_payments_paidById_fkey" FOREIGN KEY ("paidById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_rent_payments" ADD CONSTRAINT "vehicle_rent_payments_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "expenses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

