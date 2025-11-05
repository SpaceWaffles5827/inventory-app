-- First, update existing NULL values to have the default structure
UPDATE `workspaces` 
SET `default_location_structure` = '{"levels":[{"label":"Zone"},{"label":"Aisle"},{"label":"Shelf"},{"label":"Bin"}]}'
WHERE `default_location_structure` IS NULL;

-- Then alter the column to be NOT NULL with default
ALTER TABLE `workspaces` 
MODIFY COLUMN `default_location_structure` JSON NOT NULL DEFAULT ('{"levels":[{"label":"Zone"},{"label":"Aisle"},{"label":"Shelf"},{"label":"Bin"}]}');