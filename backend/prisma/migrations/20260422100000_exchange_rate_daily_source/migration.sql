-- Extend exchange rates to support daily source snapshots and idempotent upserts.
-- Columns were added in a previous partial migration attempt; this migration finalizes indexes.
ALTER TABLE `ExchangeRate`
    DROP INDEX `ExchangeRate_fromCurrencyId_toCurrencyId_key`,
    ADD UNIQUE INDEX `exrate_src_day_pair_uq`
      (`source`, `effectiveDate`, `fromCurrencyId`, `toCurrencyId`),
    ADD INDEX `exrate_pair_day_idx`
      (`fromCurrencyId`, `toCurrencyId`, `effectiveDate`);
