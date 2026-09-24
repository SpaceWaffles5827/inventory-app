-- =============================================================================
-- Lots + multi-location inventory, with a lossless conversion of existing data.
--
-- Replaces the four drifted dev migrations. Runs on a database that has only
-- `20251102135518_init` applied (production as of 2026-09-24).
--
-- Order matters because MySQL DDL is not transactional:
--   1. EXPAND   - create new tables, add new columns as NULLable (nothing dropped)
--   2. BACKFILL - convert existing data into the new structure
--   3. VERIFY   - abort (before anything is dropped) unless every unit of stock,
--                 every item, location and stock movement made it across
--   4. CONTRACT - tighten constraints, add foreign keys, drop the old columns
--
-- Conversion rules (mirror what the app itself does for non-lot-tracked items):
--   * every item gets one SYSTEM lot (isSystem = true) holding its current stock
--   * stock lives in lot_locations at the item's current location; item_locations
--     caches the per-location total
--   * items that have stock but no location are placed in a per-workspace
--     "UNASSIGNED" location so their stock is not lost
--   * location zone/aisle/shelf/bin become the location's `structure` JSON
--   * every existing stock movement is linked to its item's SYSTEM lot
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. EXPAND
-- -----------------------------------------------------------------------------

CREATE TABLE `customers` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `contactPerson` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `address` VARCHAR(191) NULL,
    `company` VARCHAR(191) NULL,
    `orderCount` INTEGER NOT NULL DEFAULT 0,
    `totalSpent` DOUBLE NOT NULL DEFAULT 0,
    `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `workspaceId` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `item_customers` (
    `id` VARCHAR(191) NOT NULL,
    `quantity` INTEGER NOT NULL DEFAULT 0,
    `lastOrderDate` DATETIME(3) NULL,
    `notes` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `itemId` VARCHAR(191) NOT NULL,
    `customerId` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `item_customers_itemId_customerId_key`(`itemId`, `customerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

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
    `createdBy` VARCHAR(191) NOT NULL,

    INDEX `lots_expirationDate_idx`(`expirationDate`),
    INDEX `lots_status_idx`(`status`),
    INDEX `lots_itemId_idx`(`itemId`),
    INDEX `lots_lotNumber_idx`(`lotNumber`),
    UNIQUE INDEX `lots_workspaceId_itemId_lotNumber_key`(`workspaceId`, `itemId`, `lotNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

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

-- New columns, NULLable for now so existing rows are valid until backfilled.
ALTER TABLE `items`
    ADD COLUMN `lotTracking` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `unit` VARCHAR(191) NULL,
    MODIFY `description` TEXT NULL;

ALTER TABLE `locations`
    ADD COLUMN `barcode` VARCHAR(191) NULL,
    ADD COLUMN `structure` JSON NULL;

ALTER TABLE `stock_transactions`
    ADD COLUMN `fromLocationId` VARCHAR(191) NULL,
    ADD COLUMN `lotId` VARCHAR(191) NULL,
    ADD COLUMN `toLocationId` VARCHAR(191) NULL,
    MODIFY `type` ENUM('INPUT', 'OUTPUT', 'TRANSFER') NOT NULL;

-- Prisma does not emit JSON column defaults for MySQL, so the DB default is
-- declared here (as the dev branch did). It also fills every existing workspace.
ALTER TABLE `workspaces`
    ADD COLUMN `default_location_structure` JSON NOT NULL
    DEFAULT ('{"levels":[{"label":"Zone"},{"label":"Aisle"},{"label":"Shelf"},{"label":"Bin"}]}');

-- -----------------------------------------------------------------------------
-- 2. BACKFILL
-- -----------------------------------------------------------------------------

-- 2a. Location structure from the old fixed zone/aisle/shelf/bin columns, in the
--     app's shape: [{label, value}, ...], only levels that have a value (as the
--     location dialogs save it). Values are kept verbatim; `code` is unchanged.
UPDATE `locations`
SET `structure` = CAST(CONCAT('[', CONCAT_WS(',',
    IF(TRIM(`zone`)  <> '', JSON_OBJECT('label', 'Zone',  'value', TRIM(`zone`)),  NULL),
    IF(TRIM(`aisle`) <> '', JSON_OBJECT('label', 'Aisle', 'value', TRIM(`aisle`)), NULL),
    IF(TRIM(`shelf`) <> '', JSON_OBJECT('label', 'Shelf', 'value', TRIM(`shelf`)), NULL),
    IF(TRIM(`bin`)   <> '', JSON_OBJECT('label', 'Bin',   'value', TRIM(`bin`)),   NULL)
), ']') AS JSON);

-- A location whose levels were all blank gets its code as a single level.
UPDATE `locations`
SET `structure` = JSON_ARRAY(JSON_OBJECT('label', 'Zone', 'value', `code`))
WHERE JSON_LENGTH(`structure`) = 0;

-- Scannable barcode, using the app's own default for new locations ("LOC-{code}").
UPDATE `locations` SET `barcode` = CONCAT('LOC-', `code`);

-- 2b. An "UNASSIGNED" location in each workspace that has stocked items with no
--     location, so that stock has somewhere to live.
INSERT INTO `locations`
    (`id`, `code`, `zone`, `aisle`, `shelf`, `bin`, `capacity`, `description`,
     `structure`, `barcode`, `createdAt`, `updatedAt`, `workspaceId`)
SELECT
    CONCAT('cunassigned', w.`id`), 'UNASSIGNED', 'UNASSIGNED', '', '', '', 100,
    'Created during the lots migration for items that had stock but no location',
    JSON_ARRAY(JSON_OBJECT('label', 'Zone', 'value', 'UNASSIGNED')), 'LOC-UNASSIGNED',
    CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3), w.`id`
FROM `workspaces` w
WHERE EXISTS (
    SELECT 1 FROM `items` i
    WHERE i.`workspaceId` = w.`id` AND i.`locationId` IS NULL AND i.`onHand` > 0
);

UPDATE `items` i
JOIN `locations` l ON l.`id` = CONCAT('cunassigned', i.`workspaceId`)
SET i.`locationId` = l.`id`
WHERE i.`locationId` IS NULL AND i.`onHand` > 0;

-- 2c. One SYSTEM lot per item holding its current stock. The workspace owner is
--     recorded as creator (the old schema did not track who added stock).
INSERT INTO `lots`
    (`id`, `lotNumber`, `quantity`, `initialQuantity`, `receivedDate`, `status`,
     `isSystem`, `createdAt`, `updatedAt`, `itemId`, `workspaceId`, `createdBy`)
SELECT
    CONCAT('clot', i.`id`), 'SYSTEM', i.`onHand`, i.`onHand`, i.`createdAt`, 'ACTIVE',
    true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3), i.`id`, i.`workspaceId`,
    (SELECT MIN(m.`userId`) FROM `workspace_members` m
      WHERE m.`workspaceId` = i.`workspaceId` AND m.`role` = 'OWNER')
FROM `items` i;

-- 2d. Where each lot's stock physically is (source of truth for quantities).
INSERT INTO `lot_locations`
    (`id`, `quantity`, `createdAt`, `updatedAt`, `lotId`, `locationId`)
SELECT
    CONCAT('clotloc', i.`id`), i.`onHand`, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3),
    CONCAT('clot', i.`id`), i.`locationId`
FROM `items` i
WHERE i.`locationId` IS NOT NULL AND i.`onHand` > 0;

-- 2e. Per-item/location cache. Kept for every item that had a location, even
--     with zero stock, so the item's location assignment is not lost.
INSERT INTO `item_locations`
    (`id`, `quantity`, `createdAt`, `updatedAt`, `itemId`, `locationId`)
SELECT
    CONCAT('citemloc', i.`id`), i.`onHand`, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3),
    i.`id`, i.`locationId`
FROM `items` i
WHERE i.`locationId` IS NOT NULL;

-- 2f. Link every historical stock movement to its item's SYSTEM lot. Old INPUT/
--     OUTPUT rows keep NULL from/to locations, as the app itself writes them.
UPDATE `stock_transactions` t
SET t.`lotId` = CONCAT('clot', t.`itemId`);

-- 2g. Stock status is derived, not user-entered: recompute it with the app's
--     thresholds (0 = out of stock, under 10 = low stock). Item.unit is left
--     NULL; the app has no default and displays it as "EA".
UPDATE `items`
SET `status` = CASE
    WHEN `onHand` <= 0 THEN 'OUT_OF_STOCK'
    WHEN `onHand` < 10 THEN 'LOW_STOCK'
    ELSE 'IN_STOCK'
END;

-- -----------------------------------------------------------------------------
-- 3. VERIFY — a failed CHECK aborts the migration here, before anything is
--    dropped. Every expectation is computed against the old columns, which
--    still exist at this point.
-- -----------------------------------------------------------------------------

CREATE TABLE `_lots_migration_check` (
    `name` VARCHAR(64) NOT NULL,
    `ok` TINYINT NOT NULL,
    CONSTRAINT `lots_migration_check_must_pass` CHECK (`ok` = 1)
);

INSERT INTO `_lots_migration_check` (`name`, `ok`)
SELECT 'every item has exactly one SYSTEM lot',
    (SELECT COUNT(*) FROM `items`) =
    (SELECT COUNT(*) FROM `lots` WHERE `isSystem` = true AND `lotNumber` = 'SYSTEM')
    AND NOT EXISTS (SELECT 1 FROM `items` i LEFT JOIN `lots` l ON l.`itemId` = i.`id` WHERE l.`id` IS NULL);

INSERT INTO `_lots_migration_check` (`name`, `ok`)
SELECT 'every lot has a creator',
    NOT EXISTS (SELECT 1 FROM `lots` WHERE `createdBy` IS NULL);

INSERT INTO `_lots_migration_check` (`name`, `ok`)
SELECT 'total stock preserved in lot_locations',
    (SELECT COALESCE(SUM(`onHand`), 0) FROM `items`) =
    (SELECT COALESCE(SUM(`quantity`), 0) FROM `lot_locations`);

INSERT INTO `_lots_migration_check` (`name`, `ok`)
SELECT 'total stock preserved in lot and item_location caches',
    (SELECT COALESCE(SUM(`onHand`), 0) FROM `items`) = (SELECT COALESCE(SUM(`quantity`), 0) FROM `lots`)
    AND (SELECT COALESCE(SUM(`onHand`), 0) FROM `items`) = (SELECT COALESCE(SUM(`quantity`), 0) FROM `item_locations`);

INSERT INTO `_lots_migration_check` (`name`, `ok`)
SELECT 'stock preserved per item and location',
    NOT EXISTS (
        SELECT 1 FROM `items` i
        LEFT JOIN `lot_locations` ll ON ll.`lotId` = CONCAT('clot', i.`id`) AND ll.`locationId` = i.`locationId`
        WHERE i.`onHand` > 0 AND (ll.`id` IS NULL OR ll.`quantity` <> i.`onHand`)
    );

INSERT INTO `_lots_migration_check` (`name`, `ok`)
SELECT 'no stock left without a location',
    NOT EXISTS (SELECT 1 FROM `items` WHERE `onHand` > 0 AND `locationId` IS NULL);

INSERT INTO `_lots_migration_check` (`name`, `ok`)
SELECT 'every location assignment preserved',
    (SELECT COUNT(*) FROM `items` WHERE `locationId` IS NOT NULL) = (SELECT COUNT(*) FROM `item_locations`);

INSERT INTO `_lots_migration_check` (`name`, `ok`)
SELECT 'every location has a structure',
    NOT EXISTS (SELECT 1 FROM `locations` WHERE `structure` IS NULL);

INSERT INTO `_lots_migration_check` (`name`, `ok`)
SELECT 'every stock movement linked to a lot',
    NOT EXISTS (
        SELECT 1 FROM `stock_transactions` t LEFT JOIN `lots` l ON l.`id` = t.`lotId`
        WHERE l.`id` IS NULL
    );

DROP TABLE `_lots_migration_check`;

-- -----------------------------------------------------------------------------
-- 4. CONTRACT
-- -----------------------------------------------------------------------------

ALTER TABLE `locations` MODIFY `structure` JSON NOT NULL;
ALTER TABLE `stock_transactions` MODIFY `lotId` VARCHAR(191) NOT NULL;

ALTER TABLE `items` DROP FOREIGN KEY `items_locationId_fkey`;
DROP INDEX `items_locationId_fkey` ON `items`;
ALTER TABLE `items` DROP COLUMN `locationId`, DROP COLUMN `onHand`;

ALTER TABLE `locations`
    DROP COLUMN `aisle`,
    DROP COLUMN `bin`,
    DROP COLUMN `shelf`,
    DROP COLUMN `zone`;

CREATE UNIQUE INDEX `locations_workspaceId_barcode_key` ON `locations`(`workspaceId`, `barcode`);
CREATE INDEX `stock_transactions_lotId_idx` ON `stock_transactions`(`lotId`);
CREATE INDEX `stock_transactions_fromLocationId_idx` ON `stock_transactions`(`fromLocationId`);
CREATE INDEX `stock_transactions_toLocationId_idx` ON `stock_transactions`(`toLocationId`);

ALTER TABLE `customers` ADD CONSTRAINT `customers_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `workspaces`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `item_customers` ADD CONSTRAINT `item_customers_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `items`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `item_customers` ADD CONSTRAINT `item_customers_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `customers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `item_locations` ADD CONSTRAINT `item_locations_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `items`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `item_locations` ADD CONSTRAINT `item_locations_locationId_fkey` FOREIGN KEY (`locationId`) REFERENCES `locations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `lots` ADD CONSTRAINT `lots_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `items`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `lots` ADD CONSTRAINT `lots_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `workspaces`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `lots` ADD CONSTRAINT `lots_supplierId_fkey` FOREIGN KEY (`supplierId`) REFERENCES `suppliers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `lots` ADD CONSTRAINT `lots_createdBy_fkey` FOREIGN KEY (`createdBy`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `lot_locations` ADD CONSTRAINT `lot_locations_lotId_fkey` FOREIGN KEY (`lotId`) REFERENCES `lots`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `lot_locations` ADD CONSTRAINT `lot_locations_locationId_fkey` FOREIGN KEY (`locationId`) REFERENCES `locations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `item_images` ADD CONSTRAINT `item_images_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `items`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `item_images` ADD CONSTRAINT `item_images_uploadedBy_fkey` FOREIGN KEY (`uploadedBy`) REFERENCES `users`(`id`) ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE `stock_transactions` ADD CONSTRAINT `stock_transactions_lotId_fkey` FOREIGN KEY (`lotId`) REFERENCES `lots`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `stock_transactions` ADD CONSTRAINT `stock_transactions_fromLocationId_fkey` FOREIGN KEY (`fromLocationId`) REFERENCES `locations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `stock_transactions` ADD CONSTRAINT `stock_transactions_toLocationId_fkey` FOREIGN KEY (`toLocationId`) REFERENCES `locations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `stock_transactions` RENAME INDEX `stock_transactions_itemId_fkey` TO `stock_transactions_itemId_idx`;
