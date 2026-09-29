-- The Site master is gone: the client asked for the site to be typed in rather
-- than picked from a list.
--
-- Each record now carries the site as plain text. The existing rows are filled
-- in from the master they pointed at, so nothing loses the site it was booked
-- against. The `sites` table and the `siteId` columns are left in place,
-- unread, so those older rows can still be traced back if anyone asks.
ALTER TABLE "expenses" ADD COLUMN "siteName" TEXT;
ALTER TABLE "cash_entries" ADD COLUMN "siteName" TEXT;
ALTER TABLE "vehicle_rentals" ADD COLUMN "siteName" TEXT;

UPDATE "expenses" e SET "siteName" = s."name"
  FROM "sites" s WHERE e."siteId" = s."id";

UPDATE "cash_entries" c SET "siteName" = s."name"
  FROM "sites" s WHERE c."siteId" = s."id";

UPDATE "vehicle_rentals" v SET "siteName" = s."name"
  FROM "sites" s WHERE v."siteId" = s."id";
