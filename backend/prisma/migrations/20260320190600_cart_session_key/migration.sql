-- Guest cart per browser tab: cartKey from X-Cart-Session (UUID). Order stores guestCartKey to clear the right cart after checkout.

ALTER TABLE `Order` ADD COLUMN `guestCartKey` VARCHAR(64) NULL;

ALTER TABLE `CartItem` ADD COLUMN `cartKey` VARCHAR(64) NULL;

UPDATE `CartItem` SET `cartKey` = CONCAT('legacy-user-', `userId`) WHERE `cartKey` IS NULL;

ALTER TABLE `CartItem` MODIFY `cartKey` VARCHAR(64) NOT NULL;

ALTER TABLE `CartItem` DROP FOREIGN KEY `CartItem_userId_fkey`;

ALTER TABLE `CartItem` DROP INDEX `CartItem_userId_productId_key`;

ALTER TABLE `CartItem` DROP COLUMN `userId`;

CREATE UNIQUE INDEX `CartItem_cartKey_productId_key` ON `CartItem`(`cartKey`, `productId`);
