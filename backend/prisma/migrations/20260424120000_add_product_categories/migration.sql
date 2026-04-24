CREATE TABLE `Category` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `Category_name_key`(`name`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `Category` (`name`, `createdAt`, `updatedAt`)
VALUES ('other', NOW(3), NOW(3));

ALTER TABLE `Product`
  ADD COLUMN `categoryId` INTEGER NULL;

UPDATE `Product`
SET `categoryId` = (SELECT `id` FROM `Category` WHERE `name` = 'other' LIMIT 1)
WHERE `categoryId` IS NULL;

ALTER TABLE `Product`
  MODIFY `categoryId` INTEGER NOT NULL;

ALTER TABLE `Product`
  ADD INDEX `Product_categoryId_idx`(`categoryId`);

ALTER TABLE `Product`
  ADD CONSTRAINT `Product_categoryId_fkey`
  FOREIGN KEY (`categoryId`) REFERENCES `Category`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;
