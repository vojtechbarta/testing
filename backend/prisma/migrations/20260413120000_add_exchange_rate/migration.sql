-- Exchange rates between currencies (FK to Currency). Example: 1 EUR = 24 CZK.

CREATE TABLE IF NOT EXISTS `ExchangeRate` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `fromCurrencyId` INTEGER NOT NULL,
    `toCurrencyId` INTEGER NOT NULL,
    `exchangeRate` DECIMAL(18, 8) NOT NULL,

    UNIQUE INDEX `ExchangeRate_fromCurrencyId_toCurrencyId_key`(`fromCurrencyId`, `toCurrencyId`),
    INDEX `ExchangeRate_fromCurrencyId_fkey`(`fromCurrencyId`),
    INDEX `ExchangeRate_toCurrencyId_fkey`(`toCurrencyId`),
    PRIMARY KEY (`id`),
    CONSTRAINT `ExchangeRate_fromCurrencyId_fkey` FOREIGN KEY (`fromCurrencyId`) REFERENCES `Currency`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT `ExchangeRate_toCurrencyId_fkey` FOREIGN KEY (`toCurrencyId`) REFERENCES `Currency`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
