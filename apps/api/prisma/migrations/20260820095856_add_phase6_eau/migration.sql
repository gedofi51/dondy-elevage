-- DropForeignKey
ALTER TABLE `sales` DROP FOREIGN KEY `sales_customerId_fkey`;

-- DropIndex
DROP INDEX `sales_customerId_fkey` ON `sales`;

-- AlterTable
ALTER TABLE `sales` ADD COLUMN `waterPointId` VARCHAR(191) NULL,
    MODIFY `customerId` VARCHAR(191) NULL,
    MODIFY `productType` ENUM('POULET_CHAIR', 'OEUFS', 'POUSSINS', 'EAU') NOT NULL DEFAULT 'POULET_CHAIR';

-- CreateTable
CREATE TABLE `water_points` (
    `id` VARCHAR(191) NOT NULL,
    `farmId` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `location` VARCHAR(191) NULL,
    `meterReference` VARCHAR(191) NULL,
    `initialIndex` DECIMAL(10, 2) NOT NULL,
    `tariffFcfaPerM3` INTEGER NOT NULL,
    `responsibleId` VARCHAR(191) NOT NULL,
    `status` ENUM('ACTIF', 'SUSPENDU', 'MAINTENANCE') NOT NULL DEFAULT 'ACTIF',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `createdBy` VARCHAR(191) NULL,

    INDEX `water_points_farmId_idx`(`farmId`),
    UNIQUE INDEX `water_points_farmId_code_key`(`farmId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `water_readings` (
    `id` VARCHAR(191) NOT NULL,
    `farmId` VARCHAR(191) NOT NULL,
    `waterPointId` VARCHAR(191) NOT NULL,
    `date` DATETIME(3) NOT NULL,
    `operatorId` VARCHAR(191) NULL,
    `indexMatin` DECIMAL(10, 2) NOT NULL,
    `indexSoir` DECIMAL(10, 2) NOT NULL,
    `consumptionM3` DECIMAL(10, 2) NOT NULL,
    `tariffFcfaPerM3Snapshot` INTEGER NOT NULL,
    `theoreticalAmountFcfa` INTEGER NOT NULL,
    `cashAmountFcfa` INTEGER NOT NULL,
    `varianceFcfa` INTEGER NOT NULL,
    `indexAnomalyReason` TEXT NULL,
    `remarks` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `createdBy` VARCHAR(191) NULL,

    INDEX `water_readings_farmId_idx`(`farmId`),
    INDEX `water_readings_waterPointId_date_idx`(`waterPointId`, `date`),
    UNIQUE INDEX `water_readings_waterPointId_date_key`(`waterPointId`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `sales_waterPointId_idx` ON `sales`(`waterPointId`);

-- AddForeignKey
ALTER TABLE `sales` ADD CONSTRAINT `sales_waterPointId_fkey` FOREIGN KEY (`waterPointId`) REFERENCES `water_points`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sales` ADD CONSTRAINT `sales_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `customers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `water_points` ADD CONSTRAINT `water_points_farmId_fkey` FOREIGN KEY (`farmId`) REFERENCES `farms`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `water_points` ADD CONSTRAINT `water_points_responsibleId_fkey` FOREIGN KEY (`responsibleId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `water_readings` ADD CONSTRAINT `water_readings_farmId_fkey` FOREIGN KEY (`farmId`) REFERENCES `farms`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `water_readings` ADD CONSTRAINT `water_readings_waterPointId_fkey` FOREIGN KEY (`waterPointId`) REFERENCES `water_points`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `water_readings` ADD CONSTRAINT `water_readings_operatorId_fkey` FOREIGN KEY (`operatorId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
