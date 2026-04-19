-- CreateTable
CREATE TABLE `CartPromotion` (
    `cartKey` VARCHAR(64) NOT NULL,
    `appliedCode` VARCHAR(64) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`cartKey`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AlterTable
ALTER TABLE `Order` ADD COLUMN `subtotalBeforeDiscount` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `discountAmount` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `discountCode` VARCHAR(64) NULL,
    ADD COLUMN `discountPercent` INTEGER NULL;

-- Backfill snapshot for existing orders (pre-discount feature).
UPDATE `Order` SET `subtotalBeforeDiscount` = `total`;
