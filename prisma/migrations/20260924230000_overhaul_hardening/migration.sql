-- =============================================================================
-- Overhaul hardening: takes the deployed 0.2.0 schema (init + lots_and_multi_location)
-- to the overhaul schema. Purely additive for data; nothing is moved or deleted.
--
--   * invitations.token      - random accept token (links no longer use the row id)
--   * items.reorderPoint     - per-item low-stock threshold (default 10); the cached
--                              item status is recomputed with the overhaul rule
--   * lots.createdBy,
--     stock_transactions.userId - nullable, ON DELETE SET NULL (deleting a user keeps history)
--   * indexes for history queries and password-reset lookups
--
-- Existing INPUT/OUTPUT history keeps NULL from/to locations: the old app never
-- recorded them, so nothing is inferred.
--
-- A baseline of every table's row count, total stock and checksums of the rows
-- this migration must not alter is captured first; the migration aborts (CHECK
-- constraint) at the end unless all of it is unchanged.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0. Baseline
-- -----------------------------------------------------------------------------
CREATE TABLE `_overhaul_migration_baseline` AS
SELECT
    (SELECT COUNT(*) FROM `users`)              AS users_n,
    (SELECT COUNT(*) FROM `workspaces`)         AS workspaces_n,
    (SELECT COUNT(*) FROM `workspace_members`)  AS members_n,
    (SELECT COUNT(*) FROM `invitations`)        AS invitations_n,
    (SELECT COUNT(*) FROM `categories`)         AS categories_n,
    (SELECT COUNT(*) FROM `suppliers`)          AS suppliers_n,
    (SELECT COUNT(*) FROM `customers`)          AS customers_n,
    (SELECT COUNT(*) FROM `locations`)          AS locations_n,
    (SELECT COUNT(*) FROM `items`)              AS items_n,
    (SELECT COUNT(*) FROM `item_images`)        AS images_n,
    (SELECT COUNT(*) FROM `lots`)               AS lots_n,
    (SELECT COUNT(*) FROM `lot_locations`)      AS lot_locations_n,
    (SELECT COUNT(*) FROM `item_locations`)     AS item_locations_n,
    (SELECT COUNT(*) FROM `stock_transactions`) AS transactions_n,
    (SELECT COALESCE(SUM(`quantity`), 0) FROM `lot_locations`)  AS units,
    (SELECT COALESCE(SUM(`quantity`), 0) FROM `item_locations`) AS item_location_units,
    (SELECT COALESCE(SUM(`quantity`), 0) FROM `lots`)           AS lot_units,
    (SELECT COALESCE(BIT_XOR(CRC32(CONCAT_WS('|', `id`, `itemNumber`, `name`, `cost`,
        COALESCE(`barcode`, ''), COALESCE(`description`, ''), COALESCE(`unit`, ''),
        `lotTracking`, `workspaceId`, COALESCE(`categoryId`, ''), COALESCE(`supplierId`, ''))) ), 0)
        FROM `items`) AS items_crc,
    (SELECT COALESCE(BIT_XOR(CRC32(CONCAT_WS('|', `id`, `type`, `quantity`, `previousStock`,
        `newStock`, `reason`, `lotId`, `itemId`, `workspaceId`, COALESCE(`userId`, ''),
        COALESCE(`fromLocationId`, ''), COALESCE(`toLocationId`, ''), `createdAt`)) ), 0)
        FROM `stock_transactions`) AS transactions_crc,
    (SELECT COALESCE(BIT_XOR(CRC32(CONCAT_WS('|', `id`, `lotNumber`, `quantity`, `status`,
        `isSystem`, `itemId`, COALESCE(`createdBy`, '')))), 0)
        FROM `lots`) AS lots_crc,
    (SELECT COALESCE(BIT_XOR(CRC32(CONCAT_WS('|', `id`, `email`, `role`, `status`, `workspaceId`))), 0)
        FROM `invitations`) AS invitations_crc;

-- -----------------------------------------------------------------------------
-- 1. Invitations: accept token
-- -----------------------------------------------------------------------------
ALTER TABLE `invitations` ADD COLUMN `token` VARCHAR(64) NULL;
UPDATE `invitations` SET `token` = LOWER(HEX(RANDOM_BYTES(32))) WHERE `token` IS NULL;
ALTER TABLE `invitations` MODIFY `token` VARCHAR(64) NOT NULL;
CREATE UNIQUE INDEX `invitations_token_key` ON `invitations`(`token`);
CREATE INDEX `invitations_workspaceId_status_idx` ON `invitations`(`workspaceId`, `status`);

-- -----------------------------------------------------------------------------
-- 2. Items: reorder point + status cache under the new rule
--    (OUT_OF_STOCK when on-hand <= 0, LOW_STOCK when on-hand <= reorderPoint)
-- -----------------------------------------------------------------------------
ALTER TABLE `items` ADD COLUMN `reorderPoint` INTEGER NOT NULL DEFAULT 10;

UPDATE `items` i
LEFT JOIN (
    SELECT l.`itemId`, SUM(ll.`quantity`) AS on_hand
    FROM `lots` l JOIN `lot_locations` ll ON ll.`lotId` = l.`id`
    GROUP BY l.`itemId`
) s ON s.`itemId` = i.`id`
SET i.`status` = CASE
    WHEN COALESCE(s.`on_hand`, 0) <= 0 THEN 'OUT_OF_STOCK'
    WHEN s.`on_hand` <= i.`reorderPoint` THEN 'LOW_STOCK'
    ELSE 'IN_STOCK'
END;

-- -----------------------------------------------------------------------------
-- 3. Keep history when a user is deleted
-- -----------------------------------------------------------------------------
ALTER TABLE `lots` DROP FOREIGN KEY `lots_createdBy_fkey`;
ALTER TABLE `stock_transactions` DROP FOREIGN KEY `stock_transactions_userId_fkey`;
DROP INDEX `lots_createdBy_fkey` ON `lots`;
DROP INDEX `stock_transactions_userId_fkey` ON `stock_transactions`;

ALTER TABLE `lots` MODIFY `createdBy` VARCHAR(191) NULL;
ALTER TABLE `stock_transactions` MODIFY `userId` VARCHAR(191) NULL;

ALTER TABLE `lots` ADD CONSTRAINT `lots_createdBy_fkey` FOREIGN KEY (`createdBy`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `stock_transactions` ADD CONSTRAINT `stock_transactions_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- -----------------------------------------------------------------------------
-- 4. Indexes
-- -----------------------------------------------------------------------------
CREATE INDEX `stock_transactions_itemId_createdAt_idx` ON `stock_transactions`(`itemId`, `createdAt`);
CREATE INDEX `stock_transactions_workspaceId_createdAt_idx` ON `stock_transactions`(`workspaceId`, `createdAt`);
CREATE INDEX `users_password_reset_token_idx` ON `users`(`password_reset_token`);

-- -----------------------------------------------------------------------------
-- 5. VERIFY - everything this migration must not change is unchanged
-- -----------------------------------------------------------------------------
CREATE TABLE `_overhaul_migration_check` (
    `name` VARCHAR(64) NOT NULL,
    `ok` TINYINT NOT NULL,
    CONSTRAINT `overhaul_migration_check_must_pass` CHECK (`ok` = 1)
);

INSERT INTO `_overhaul_migration_check` (`name`, `ok`)
SELECT 'row counts unchanged',
    b.users_n = (SELECT COUNT(*) FROM `users`)
    AND b.workspaces_n = (SELECT COUNT(*) FROM `workspaces`)
    AND b.members_n = (SELECT COUNT(*) FROM `workspace_members`)
    AND b.invitations_n = (SELECT COUNT(*) FROM `invitations`)
    AND b.categories_n = (SELECT COUNT(*) FROM `categories`)
    AND b.suppliers_n = (SELECT COUNT(*) FROM `suppliers`)
    AND b.customers_n = (SELECT COUNT(*) FROM `customers`)
    AND b.locations_n = (SELECT COUNT(*) FROM `locations`)
    AND b.items_n = (SELECT COUNT(*) FROM `items`)
    AND b.images_n = (SELECT COUNT(*) FROM `item_images`)
    AND b.lots_n = (SELECT COUNT(*) FROM `lots`)
    AND b.lot_locations_n = (SELECT COUNT(*) FROM `lot_locations`)
    AND b.item_locations_n = (SELECT COUNT(*) FROM `item_locations`)
    AND b.transactions_n = (SELECT COUNT(*) FROM `stock_transactions`)
FROM `_overhaul_migration_baseline` b;

INSERT INTO `_overhaul_migration_check` (`name`, `ok`)
SELECT 'stock unchanged',
    b.units = (SELECT COALESCE(SUM(`quantity`), 0) FROM `lot_locations`)
    AND b.item_location_units = (SELECT COALESCE(SUM(`quantity`), 0) FROM `item_locations`)
    AND b.lot_units = (SELECT COALESCE(SUM(`quantity`), 0) FROM `lots`)
FROM `_overhaul_migration_baseline` b;

INSERT INTO `_overhaul_migration_check` (`name`, `ok`)
SELECT 'items, history, lots and invitations unchanged (checksums)',
    b.items_crc = (SELECT COALESCE(BIT_XOR(CRC32(CONCAT_WS('|', `id`, `itemNumber`, `name`, `cost`,
        COALESCE(`barcode`, ''), COALESCE(`description`, ''), COALESCE(`unit`, ''),
        `lotTracking`, `workspaceId`, COALESCE(`categoryId`, ''), COALESCE(`supplierId`, ''))) ), 0) FROM `items`)
    AND b.transactions_crc = (SELECT COALESCE(BIT_XOR(CRC32(CONCAT_WS('|', `id`, `type`, `quantity`, `previousStock`,
        `newStock`, `reason`, `lotId`, `itemId`, `workspaceId`, COALESCE(`userId`, ''),
        COALESCE(`fromLocationId`, ''), COALESCE(`toLocationId`, ''), `createdAt`)) ), 0) FROM `stock_transactions`)
    AND b.lots_crc = (SELECT COALESCE(BIT_XOR(CRC32(CONCAT_WS('|', `id`, `lotNumber`, `quantity`, `status`,
        `isSystem`, `itemId`, COALESCE(`createdBy`, '')))), 0) FROM `lots`)
    AND b.invitations_crc = (SELECT COALESCE(BIT_XOR(CRC32(CONCAT_WS('|', `id`, `email`, `role`, `status`, `workspaceId`))), 0) FROM `invitations`)
FROM `_overhaul_migration_baseline` b;

INSERT INTO `_overhaul_migration_check` (`name`, `ok`)
SELECT 'every invitation has a unique token',
    NOT EXISTS (SELECT 1 FROM `invitations` WHERE `token` IS NULL OR `token` = '')
    AND (SELECT COUNT(DISTINCT `token`) FROM `invitations`) = (SELECT COUNT(*) FROM `invitations`);

DROP TABLE `_overhaul_migration_check`;
DROP TABLE `_overhaul_migration_baseline`;
