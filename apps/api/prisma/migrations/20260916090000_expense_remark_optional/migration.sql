-- An expense's description ("Remark" on screen) is now optional: the category
-- already says what the money went on. Existing rows keep their text.
ALTER TABLE "expenses" ALTER COLUMN "description" DROP NOT NULL;
