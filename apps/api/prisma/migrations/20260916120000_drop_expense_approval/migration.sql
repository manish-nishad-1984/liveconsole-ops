-- Expense approval is gone: every expense counts as soon as it is filed.
--
-- Everything still waiting (or once rejected) becomes APPROVED, so no expense is
-- left out of a balance with no screen left to approve it on. The column and the
-- review fields stay for the record of what was reviewed while approval existed.
UPDATE "expenses" SET "status" = 'APPROVED' WHERE "status" <> 'APPROVED';

ALTER TABLE "expenses" ALTER COLUMN "status" SET DEFAULT 'APPROVED';
