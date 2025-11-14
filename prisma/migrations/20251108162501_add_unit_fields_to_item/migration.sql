-- AlterTable
ALTER TABLE `items` ADD COLUMN `unit` ENUM('PCS', 'EACH', 'BOX', 'PACK', 'DOZEN', 'MG', 'G', 'KG', 'LB', 'TON', 'ML', 'L', 'GAL', 'QT', 'PT', 'FL_OZ', 'MM', 'CM', 'M', 'IN', 'FT', 'YD', 'SQ_CM', 'SQ_M', 'SQ_FT', 'ROLL', 'SHEET', 'SET', 'CASE', 'PALLET', 'BAG', 'CAN', 'BOTTLE', 'TUBE') NOT NULL DEFAULT 'PCS',
    ADD COLUMN `unitQuantity` DOUBLE NOT NULL DEFAULT 1;
