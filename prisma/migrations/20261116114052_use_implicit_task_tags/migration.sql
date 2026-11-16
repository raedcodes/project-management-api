/*
  Warnings:

  - You are about to alter the column `name` on the `Tag` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `VarChar(50)`.
  - You are about to drop the `TaskTag` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[name]` on the table `Tag` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE `TaskTag` DROP FOREIGN KEY `TaskTag_tagId_fkey`;

-- DropForeignKey
ALTER TABLE `TaskTag` DROP FOREIGN KEY `TaskTag_taskId_fkey`;

-- AlterTable
ALTER TABLE `Tag` MODIFY `name` VARCHAR(50) NOT NULL;

-- DropTable
DROP TABLE `TaskTag`;

-- CreateTable
CREATE TABLE `_TagToTask` (
    `A` VARCHAR(191) NOT NULL,
    `B` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `_TagToTask_AB_unique`(`A`, `B`),
    INDEX `_TagToTask_B_index`(`B`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `Tag_name_key` ON `Tag`(`name`);

-- AddForeignKey
ALTER TABLE `_TagToTask` ADD CONSTRAINT `_TagToTask_A_fkey` FOREIGN KEY (`A`) REFERENCES `Tag`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_TagToTask` ADD CONSTRAINT `_TagToTask_B_fkey` FOREIGN KEY (`B`) REFERENCES `Task`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
