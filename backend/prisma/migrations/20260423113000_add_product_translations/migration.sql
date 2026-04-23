CREATE TABLE `ProductTranslation` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `productId` INTEGER NOT NULL,
  `locale` VARCHAR(8) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `description` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  INDEX `product_translation_locale_idx`(`locale`),
  UNIQUE INDEX `product_locale_unique`(`productId`, `locale`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `ProductTranslation`
  ADD CONSTRAINT `ProductTranslation_productId_fkey`
  FOREIGN KEY (`productId`) REFERENCES `Product`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;
