-- Closing the books.
--
-- An administrator draws a line under everything recorded so far: each
-- employee's balance is written as an opening figure, and the entries behind it
-- stop counting and stop appearing. Nothing is deleted — each archived row is
-- stamped with the closure that archived it, so releasing them again is a
-- single update and the whole action can be undone.
CREATE TABLE "ledger_closures" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "closedOn" DATE NOT NULL,
    "note" TEXT,
    "entryCount" INTEGER NOT NULL DEFAULT 0,
    "openingTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "reversedAt" TIMESTAMP(3),
    "reversedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" UUID,

    CONSTRAINT "ledger_closures_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ledger_openings" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "closureId" UUID NOT NULL,
    "employeeId" UUID NOT NULL,
    -- Signed: negative when the employee had spent more than they were given.
    "amount" DECIMAL(12,2) NOT NULL,
    -- Set when a later closure carried this figure into its own opening; without
    -- it the same money would be counted once per closure.
    "supersededById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ledger_openings_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ledger_closures_organizationId_reversedAt_idx" ON "ledger_closures"("organizationId", "reversedAt");
CREATE UNIQUE INDEX "ledger_openings_closureId_employeeId_key" ON "ledger_openings"("closureId", "employeeId");
CREATE INDEX "ledger_openings_organizationId_employeeId_idx" ON "ledger_openings"("organizationId", "employeeId");
CREATE INDEX "ledger_openings_supersededById_idx" ON "ledger_openings"("supersededById");

ALTER TABLE "ledger_closures" ADD CONSTRAINT "ledger_closures_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ledger_openings" ADD CONSTRAINT "ledger_openings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ledger_openings" ADD CONSTRAINT "ledger_openings_closureId_fkey" FOREIGN KEY ("closureId") REFERENCES "ledger_closures"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ledger_openings" ADD CONSTRAINT "ledger_openings_supersededById_fkey" FOREIGN KEY ("supersededById") REFERENCES "ledger_closures"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ledger_openings" ADD CONSTRAINT "ledger_openings_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Null means the row belongs to the period being worked in now.
ALTER TABLE "cash_entries" ADD COLUMN "closureId" UUID;
ALTER TABLE "expenses" ADD COLUMN "closureId" UUID;

CREATE INDEX "cash_entries_organizationId_closureId_idx" ON "cash_entries"("organizationId", "closureId");
CREATE INDEX "expenses_organizationId_closureId_idx" ON "expenses"("organizationId", "closureId");

ALTER TABLE "cash_entries" ADD CONSTRAINT "cash_entries_closureId_fkey" FOREIGN KEY ("closureId") REFERENCES "ledger_closures"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_closureId_fkey" FOREIGN KEY ("closureId") REFERENCES "ledger_closures"("id") ON DELETE SET NULL ON UPDATE CASCADE;
