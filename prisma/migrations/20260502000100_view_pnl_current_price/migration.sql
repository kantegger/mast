-- Store the user-committed current price used for a 60-second ViewPnLFlow unlock.
ALTER TABLE "ViewPnLFlow" ADD COLUMN "currentPrice" DECIMAL;
