-- Rename columns: values are whole currency units (CZK) in this project; drop misleading *Cents names.

ALTER TABLE `Product` CHANGE `priceCents` `price` INTEGER NOT NULL;
ALTER TABLE `Order` CHANGE `totalCents` `total` INTEGER NOT NULL;
ALTER TABLE `OrderItem` CHANGE `unitPriceCents` `unitPrice` INTEGER NOT NULL;
