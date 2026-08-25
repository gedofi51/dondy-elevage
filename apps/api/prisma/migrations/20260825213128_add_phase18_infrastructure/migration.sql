-- CreateTable
CREATE TABLE `water_infrastructure_readings` (
    `id` VARCHAR(191) NOT NULL,
    `farmId` VARCHAR(191) NOT NULL,
    `assetId` VARCHAR(191) NOT NULL,
    `date` DATETIME(3) NOT NULL,
    `pumpedVolumeM3` DECIMAL(10, 2) NULL,
    `reservoirLevelPercent` DECIMAL(5, 2) NULL,
    `pumpHoursCumulative` DECIMAL(10, 2) NULL,
    `farmInternalConsumptionM3` DECIMAL(10, 2) NULL,
    `observations` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `createdBy` VARCHAR(191) NULL,

    INDEX `water_infrastructure_readings_farmId_idx`(`farmId`),
    UNIQUE INDEX `water_infrastructure_readings_assetId_date_key`(`assetId`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `solar_infrastructure_readings` (
    `id` VARCHAR(191) NOT NULL,
    `farmId` VARCHAR(191) NOT NULL,
    `assetId` VARCHAR(191) NOT NULL,
    `date` DATETIME(3) NOT NULL,
    `dailyProductionKwh` DECIMAL(10, 2) NULL,
    `batteryChargePercent` DECIMAL(5, 2) NULL,
    `instantaneousPowerKw` DECIMAL(10, 2) NULL,
    `observations` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `createdBy` VARCHAR(191) NULL,

    INDEX `solar_infrastructure_readings_farmId_idx`(`farmId`),
    UNIQUE INDEX `solar_infrastructure_readings_assetId_date_key`(`assetId`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `network_status_readings` (
    `id` VARCHAR(191) NOT NULL,
    `farmId` VARCHAR(191) NOT NULL,
    `assetId` VARCHAR(191) NOT NULL,
    `date` DATETIME(3) NOT NULL,
    `operationalStatus` ENUM('OPERATIONNEL', 'DEGRADE', 'HORS_LIGNE') NOT NULL,
    `observations` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `createdBy` VARCHAR(191) NULL,

    INDEX `network_status_readings_farmId_idx`(`farmId`),
    UNIQUE INDEX `network_status_readings_assetId_date_key`(`assetId`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `water_infrastructure_readings` ADD CONSTRAINT `water_infrastructure_readings_farmId_fkey` FOREIGN KEY (`farmId`) REFERENCES `farms`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `water_infrastructure_readings` ADD CONSTRAINT `water_infrastructure_readings_assetId_fkey` FOREIGN KEY (`assetId`) REFERENCES `assets`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `solar_infrastructure_readings` ADD CONSTRAINT `solar_infrastructure_readings_farmId_fkey` FOREIGN KEY (`farmId`) REFERENCES `farms`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `solar_infrastructure_readings` ADD CONSTRAINT `solar_infrastructure_readings_assetId_fkey` FOREIGN KEY (`assetId`) REFERENCES `assets`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `network_status_readings` ADD CONSTRAINT `network_status_readings_farmId_fkey` FOREIGN KEY (`farmId`) REFERENCES `farms`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `network_status_readings` ADD CONSTRAINT `network_status_readings_assetId_fkey` FOREIGN KEY (`assetId`) REFERENCES `assets`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
