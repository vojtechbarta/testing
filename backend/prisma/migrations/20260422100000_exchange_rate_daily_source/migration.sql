-- Extend exchange rates for daily source snapshots.
-- Older databases may already have these columns from partial applies; fresh DBs
-- created only `exchangeRate` columns in `20260413120000_add_exchange_rate`.

ALTER TABLE `ExchangeRate`
  ADD COLUMN `source` VARCHAR(191) NOT NULL DEFAULT 'MANUAL',
  ADD COLUMN `effectiveDate` DATE NOT NULL DEFAULT (CURRENT_DATE),
  ADD COLUMN `sourceAmount` INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  ADD COLUMN `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3);

ALTER TABLE `ExchangeRate`
    DROP INDEX `ExchangeRate_fromCurrencyId_toCurrencyId_key`,
    ADD UNIQUE INDEX `exrate_src_day_pair_uq`
      (`source`, `effectiveDate`, `fromCurrencyId`, `toCurrencyId`),
    ADD INDEX `exrate_pair_day_idx`
      (`fromCurrencyId`, `toCurrencyId`, `effectiveDate`);
