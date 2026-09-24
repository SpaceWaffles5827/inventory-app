-- Sync the migration history with prisma/schema.prisma.
--
-- Takes a database at 20251108162501_add_unit_fields_to_item (items carry a
-- single `onHand` + `locationId`) to the lot-based model:
--   * LotLocation is the source of truth for stock. Each item's legacy stock is
--     moved into a SYSTEM lot at the item's location (stock that had no location
--     goes to a per-workspace "UNASSIGNED" location, created only if needed).
--   * Every existing stock transaction is attached to its item's SYSTEM lot and
--     to the item's location.
--   * Invitations get a random `token` (accept links no longer use the row id).
--     Pending invitations sent before this migration must be re-sent.
--   * StockTransaction.userId / Lot.createdBy become nullable (ON DELETE SET NULL)
--     so deleting a user keeps the history.
--   * items.reorderPoint (default 10) drives LOW_STOCK.

-- DropForeignKey
ALTER TABLE `items` DROP FOREIGN KEY `items_locationId_fkey`;

-- DropForeignKey
ALTER TABLE `stock_transactions` DROP FOREIGN KEY `stock_transactions_userId_fkey`;

-- DropIndex
DROP INDEX `items_locationId_fkey` ON `items`;

-- DropIndex
DROP INDEX `stock_transactions_userId_fkey` ON `stock_transactions`;

-- AlterTable: invitations.token (add nullable, backfill with random values, then enforce)
ALTER TABLE `invitations` ADD COLUMN `token` VARCHAR(64) NULL;
UPDATE `invitations` SET `token` = LOWER(HEX(RANDOM_BYTES(24))) WHERE `token` IS NULL;
ALTER TABLE `invitations` MODIFY `token` VARCHAR(64) NOT NULL;

-- AlterTable: items (legacy onHand / locationId are dropped after the data move below)
ALTER TABLE `items` ADD COLUMN `lotTracking` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `reorderPoint` INTEGER NOT NULL DEFAULT 10,
    MODIFY `description` TEXT NULL,
    MODIFY `unit` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `locations` ADD COLUMN `barcode` VARCHAR(191) NULL;

-- AlterTable: lotId starts nullable so existing rows can be backfilled
ALTER TABLE `stock_transactions` ADD COLUMN `fromLocationId` VARCHAR(191) NULL,
    ADD COLUMN `lotId` VARCHAR(191) NULL,
    ADD COLUMN `toLocationId` VARCHAR(191) NULL,
    MODIFY `type` ENUM('INPUT', 'OUTPUT', 'TRANSFER') NOT NULL,
    MODIFY `userId` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `item_locations` (
    `id` VARCHAR(191) NOT NULL,
    `quantity` INTEGER NOT NULL DEFAULT 0,
    `minStock` INTEGER NOT NULL DEFAULT 0,
    `maxStock` INTEGER NOT NULL DEFAULT 0,
    `notes` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `itemId` VARCHAR(191) NOT NULL,
    `locationId` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `item_locations_itemId_locationId_key`(`itemId`, `locationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `lots` (
    `id` VARCHAR(191) NOT NULL,
    `lotNumber` VARCHAR(191) NOT NULL,
    `quantity` INTEGER NOT NULL DEFAULT 0,
    `initialQuantity` INTEGER NOT NULL,
    `receivedDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `manufactureDate` DATETIME(3) NULL,
    `expirationDate` DATETIME(3) NULL,
    `status` ENUM('ACTIVE', 'DEPLETED', 'EXPIRED', 'QUARANTINED', 'RECALLED') NOT NULL DEFAULT 'ACTIVE',
    `poNumber` VARCHAR(191) NULL,
    `notes` TEXT NULL,
    `isSystem` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `itemId` VARCHAR(191) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,
    `supplierId` VARCHAR(191) NULL,
    `createdBy` VARCHAR(191) NULL,

    INDEX `lots_expirationDate_idx`(`expirationDate`),
    INDEX `lots_status_idx`(`status`),
    INDEX `lots_itemId_idx`(`itemId`),
    INDEX `lots_lotNumber_idx`(`lotNumber`),
    UNIQUE INDEX `lots_workspaceId_itemId_lotNumber_key`(`workspaceId`, `itemId`, `lotNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `lot_locations` (
    `id` VARCHAR(191) NOT NULL,
    `quantity` INTEGER NOT NULL DEFAULT 0,
    `notes` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `lotId` VARCHAR(191) NOT NULL,
    `locationId` VARCHAR(191) NOT NULL,

    INDEX `lot_locations_lotId_idx`(`lotId`),
    INDEX `lot_locations_locationId_idx`(`locationId`),
    UNIQUE INDEX `lot_locations_lotId_locationId_key`(`lotId`, `locationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `item_images` (
    `id` VARCHAR(191) NOT NULL,
    `itemId` VARCHAR(191) NOT NULL,
    `imageName` VARCHAR(191) NOT NULL,
    `isPrimary` BOOLEAN NOT NULL DEFAULT false,
    `displayOrder` INTEGER NOT NULL DEFAULT 0,
    `uploadedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `uploadedBy` VARCHAR(191) NOT NULL,

    INDEX `item_images_itemId_displayOrder_idx`(`itemId`, `displayOrder`),
    INDEX `item_images_itemId_isPrimary_idx`(`itemId`, `isPrimary`),
    INDEX `item_images_uploadedBy_idx`(`uploadedBy`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Data migration: legacy items.onHand / items.locationId -> lots model
-- ---------------------------------------------------------------------------

-- Stock that had no location goes to an "UNASSIGNED" location per workspace.
INSERT INTO `locations` (`id`, `code`, `barcode`, `structure`, `capacity`, `description`, `createdAt`, `updatedAt`, `workspaceId`)
SELECT CONCAT('mig', LOWER(HEX(RANDOM_BYTES(11)))), 'UNASSIGNED', NULL,
       JSON_ARRAY(JSON_OBJECT('label', 'Zone', 'value', 'UNASSIGNED')), 100,
       'Created by migration for stock that had no location', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3), w.`workspaceId`
FROM (SELECT DISTINCT `workspaceId` FROM `items` WHERE `onHand` > 0 AND `locationId` IS NULL) w
WHERE NOT EXISTS (
  SELECT 1 FROM `locations` l WHERE l.`workspaceId` = w.`workspaceId` AND l.`code` = 'UNASSIGNED'
);

UPDATE `items` i
JOIN `locations` l ON l.`workspaceId` = i.`workspaceId` AND l.`code` = 'UNASSIGNED'
SET i.`locationId` = l.`id`
WHERE i.`onHand` > 0 AND i.`locationId` IS NULL;

-- One SYSTEM lot per item holding its legacy stock.
INSERT INTO `lots` (`id`, `lotNumber`, `quantity`, `initialQuantity`, `receivedDate`, `status`, `isSystem`, `createdAt`, `updatedAt`, `itemId`, `workspaceId`, `supplierId`, `createdBy`)
SELECT CONCAT('mig', LOWER(HEX(RANDOM_BYTES(11)))), 'SYSTEM', GREATEST(i.`onHand`, 0), GREATEST(i.`onHand`, 0),
       i.`createdAt`, IF(i.`onHand` > 0, 'ACTIVE', 'DEPLETED'), true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3),
       i.`id`, i.`workspaceId`, NULL, NULL
FROM `items` i;

-- Source of truth: the SYSTEM lot's units at the item's location.
INSERT INTO `lot_locations` (`id`, `quantity`, `createdAt`, `updatedAt`, `lotId`, `locationId`)
SELECT CONCAT('mig', LOWER(HEX(RANDOM_BYTES(11)))), i.`onHand`, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3), l.`id`, i.`locationId`
FROM `items` i
JOIN `lots` l ON l.`itemId` = i.`id` AND l.`lotNumber` = 'SYSTEM'
WHERE i.`locationId` IS NOT NULL AND i.`onHand` > 0;

-- Item <-> location assignment (quantity is a cache of the above).
INSERT INTO `item_locations` (`id`, `quantity`, `minStock`, `maxStock`, `createdAt`, `updatedAt`, `itemId`, `locationId`)
SELECT CONCAT('mig', LOWER(HEX(RANDOM_BYTES(11)))), GREATEST(i.`onHand`, 0), 0, 0, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3), i.`id`, i.`locationId`
FROM `items` i
WHERE i.`locationId` IS NOT NULL;

-- Existing history: attach to the SYSTEM lot and the item's (single) location.
UPDATE `stock_transactions` t
JOIN `lots` l ON l.`itemId` = t.`itemId` AND l.`lotNumber` = 'SYSTEM'
SET t.`lotId` = l.`id`
WHERE t.`lotId` IS NULL;

UPDATE `stock_transactions` t
JOIN `items` i ON i.`id` = t.`itemId`
SET t.`toLocationId` = IF(t.`type` = 'INPUT', i.`locationId`, NULL),
    t.`fromLocationId` = IF(t.`type` = 'OUTPUT', i.`locationId`, NULL)
WHERE t.`fromLocationId` IS NULL AND t.`toLocationId` IS NULL;

-- Status cache with the new reorder point rule.
UPDATE `items`
SET `status` = CASE
  WHEN `onHand` <= 0 THEN 'OUT_OF_STOCK'
  WHEN `onHand` <= `reorderPoint` THEN 'LOW_STOCK'
  ELSE 'IN_STOCK'
END;

ALTER TABLE `stock_transactions` MODIFY `lotId` VARCHAR(191) NOT NULL;

-- Legacy columns are no longer used.
ALTER TABLE `items` DROP COLUMN `locationId`,
    DROP COLUMN `onHand`,
    DROP COLUMN `unitQuantity`;

-- ---------------------------------------------------------------------------
-- Indexes + foreign keys
-- ---------------------------------------------------------------------------

-- CreateIndex
CREATE UNIQUE INDEX `invitations_token_key` ON `invitations`(`token`);

-- CreateIndex
CREATE INDEX `invitations_workspaceId_status_idx` ON `invitations`(`workspaceId`, `status`);

-- CreateIndex
CREATE UNIQUE INDEX `locations_workspaceId_barcode_key` ON `locations`(`workspaceId`, `barcode`);

-- CreateIndex
CREATE INDEX `stock_transactions_lotId_idx` ON `stock_transactions`(`lotId`);

-- CreateIndex
CREATE INDEX `stock_transactions_itemId_createdAt_idx` ON `stock_transactions`(`itemId`, `createdAt`);

-- CreateIndex
CREATE INDEX `stock_transactions_workspaceId_createdAt_idx` ON `stock_transactions`(`workspaceId`, `createdAt`);

-- CreateIndex
CREATE INDEX `stock_transactions_fromLocationId_idx` ON `stock_transactions`(`fromLocationId`);

-- CreateIndex
CREATE INDEX `stock_transactions_toLocationId_idx` ON `stock_transactions`(`toLocationId`);

-- CreateIndex
CREATE INDEX `users_password_reset_token_idx` ON `users`(`password_reset_token`);

-- AddForeignKey
ALTER TABLE `item_locations` ADD CONSTRAINT `item_locations_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `items`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `item_locations` ADD CONSTRAINT `item_locations_locationId_fkey` FOREIGN KEY (`locationId`) REFERENCES `locations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lots` ADD CONSTRAINT `lots_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `items`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lots` ADD CONSTRAINT `lots_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `workspaces`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lots` ADD CONSTRAINT `lots_supplierId_fkey` FOREIGN KEY (`supplierId`) REFERENCES `suppliers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lots` ADD CONSTRAINT `lots_createdBy_fkey` FOREIGN KEY (`createdBy`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lot_locations` ADD CONSTRAINT `lot_locations_lotId_fkey` FOREIGN KEY (`lotId`) REFERENCES `lots`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lot_locations` ADD CONSTRAINT `lot_locations_locationId_fkey` FOREIGN KEY (`locationId`) REFERENCES `locations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `item_images` ADD CONSTRAINT `item_images_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `items`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `item_images` ADD CONSTRAINT `item_images_uploadedBy_fkey` FOREIGN KEY (`uploadedBy`) REFERENCES `users`(`id`) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_transactions` ADD CONSTRAINT `stock_transactions_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_transactions` ADD CONSTRAINT `stock_transactions_lotId_fkey` FOREIGN KEY (`lotId`) REFERENCES `lots`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_transactions` ADD CONSTRAINT `stock_transactions_fromLocationId_fkey` FOREIGN KEY (`fromLocationId`) REFERENCES `locations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_transactions` ADD CONSTRAINT `stock_transactions_toLocationId_fkey` FOREIGN KEY (`toLocationId`) REFERENCES `locations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
