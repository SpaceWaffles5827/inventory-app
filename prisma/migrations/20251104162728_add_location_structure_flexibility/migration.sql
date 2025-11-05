/*
  Warnings:

  - You are about to drop the column `aisle` on the `locations` table. All the data in the column will be lost.
  - You are about to drop the column `bin` on the `locations` table. All the data in the column will be lost.
  - You are about to drop the column `shelf` on the `locations` table. All the data in the column will be lost.
  - You are about to drop the column `zone` on the `locations` table. All the data in the column will be lost.
  - Added the required column `structure` to the `locations` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `locations` DROP COLUMN `aisle`,
    DROP COLUMN `bin`,
    DROP COLUMN `shelf`,
    DROP COLUMN `zone`,
    ADD COLUMN `structure` JSON NOT NULL;

-- AlterTable
ALTER TABLE `workspaces` ADD COLUMN `default_location_structure` JSON NULL;
