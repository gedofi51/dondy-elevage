-- DropForeignKey
ALTER TABLE `sales` DROP FOREIGN KEY `sales_batchId_fkey`;

-- AlterTable
ALTER TABLE `expenses` ADD COLUMN `layerBatchId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `sales` ADD COLUMN `layerBatchId` VARCHAR(191) NULL,
    ADD COLUMN `productType` ENUM('POULET_CHAIR', 'OEUFS') NOT NULL DEFAULT 'POULET_CHAIR',
    MODIFY `batchId` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `layer_batches` (
    `id` VARCHAR(191) NOT NULL,
    `farmId` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `strain` VARCHAR(191) NULL,
    `entryDate` DATETIME(3) NOT NULL,
    `initialQuantity` INTEGER NOT NULL,
    `ageAtEntryWeeks` INTEGER NULL,
    `ageAtEntryDays` INTEGER NULL,
    `buildingId` VARCHAR(191) NOT NULL,
    `primaryManagerId` VARCHAR(191) NOT NULL,
    `status` ENUM('ELEVAGE', 'PONTE', 'REFORME', 'CLOTURE', 'ANNULEE') NOT NULL DEFAULT 'ELEVAGE',
    `observations` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `createdBy` VARCHAR(191) NULL,

    INDEX `layer_batches_farmId_idx`(`farmId`),
    INDEX `layer_batches_farmId_status_idx`(`farmId`, `status`),
    UNIQUE INDEX `layer_batches_farmId_code_key`(`farmId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `layer_daily_records` (
    `id` VARCHAR(191) NOT NULL,
    `farmId` VARCHAR(191) NOT NULL,
    `batchId` VARCHAR(191) NOT NULL,
    `date` DATETIME(3) NOT NULL,
    `operatorId` VARCHAR(191) NULL,
    `henCount` INTEGER NOT NULL,
    `mortalityQuantity` INTEGER NOT NULL DEFAULT 0,
    `cullsQuantity` INTEGER NOT NULL DEFAULT 0,
    `otherExitsQuantity` INTEGER NOT NULL DEFAULT 0,
    `eggsLaid` INTEGER NOT NULL,
    `eggsBroken` INTEGER NOT NULL DEFAULT 0,
    `eggsRejected` INTEGER NOT NULL DEFAULT 0,
    `eggsSellable` INTEGER NOT NULL,
    `layingRatePercent` DECIMAL(5, 2) NULL,
    `feedDistributedKg` DECIMAL(8, 2) NULL,
    `observations` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `layer_daily_records_farmId_idx`(`farmId`),
    INDEX `layer_daily_records_batchId_date_idx`(`batchId`, `date`),
    UNIQUE INDEX `layer_daily_records_batchId_date_key`(`batchId`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `layer_health_events` (
    `id` VARCHAR(191) NOT NULL,
    `farmId` VARCHAR(191) NOT NULL,
    `batchId` VARCHAR(191) NOT NULL,
    `date` DATETIME(3) NOT NULL,
    `status` ENUM('PREVU', 'REALISE', 'REPORTE', 'ANNULE') NOT NULL DEFAULT 'PREVU',
    `type` ENUM('VACCINATION', 'TRAITEMENT', 'PROPHYLAXIE', 'DESINFECTION', 'VITAMINE', 'CONSULTATION_VETERINAIRE') NOT NULL,
    `product` VARCHAR(191) NULL,
    `motif` TEXT NULL,
    `dose` VARCHAR(191) NULL,
    `quantity` VARCHAR(191) NULL,
    `unit` VARCHAR(191) NULL,
    `durationDays` INTEGER NULL,
    `administrationRoute` ENUM('EAU', 'INJECTION', 'AUTRE') NULL,
    `prescribedBy` VARCHAR(191) NULL,
    `performedBy` VARCHAR(191) NULL,
    `costFcfa` INTEGER NULL,
    `observation` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `createdBy` VARCHAR(191) NULL,

    INDEX `layer_health_events_farmId_idx`(`farmId`),
    INDEX `layer_health_events_batchId_date_idx`(`batchId`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `egg_stock_lots` (
    `id` VARCHAR(191) NOT NULL,
    `farmId` VARCHAR(191) NOT NULL,
    `batchId` VARCHAR(191) NOT NULL,
    `dailyRecordId` VARCHAR(191) NOT NULL,
    `productionDate` DATETIME(3) NOT NULL,
    `caliber` VARCHAR(191) NOT NULL DEFAULT 'non_calibre',
    `quantityProduced` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `egg_stock_lots_dailyRecordId_key`(`dailyRecordId`),
    INDEX `egg_stock_lots_farmId_idx`(`farmId`),
    INDEX `egg_stock_lots_batchId_productionDate_idx`(`batchId`, `productionDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `egg_stock_movements` (
    `id` VARCHAR(191) NOT NULL,
    `farmId` VARCHAR(191) NOT NULL,
    `lotId` VARCHAR(191) NOT NULL,
    `type` ENUM('SORTIE_VENTE', 'ENTREE_ANNULATION', 'PERTE_CASSE', 'PERTE_SOUILLURE', 'CONSOMMATION_INTERNE', 'DON', 'PERTE_AUTRE') NOT NULL,
    `quantity` INTEGER NOT NULL,
    `date` DATETIME(3) NOT NULL,
    `saleId` VARCHAR(191) NULL,
    `reason` TEXT NULL,
    `recordedBy` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `egg_stock_movements_farmId_idx`(`farmId`),
    INDEX `egg_stock_movements_lotId_idx`(`lotId`),
    INDEX `egg_stock_movements_saleId_idx`(`saleId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `expenses_layerBatchId_idx` ON `expenses`(`layerBatchId`);

-- CreateIndex
CREATE INDEX `sales_layerBatchId_idx` ON `sales`(`layerBatchId`);

-- AddForeignKey
ALTER TABLE `expenses` ADD CONSTRAINT `expenses_layerBatchId_fkey` FOREIGN KEY (`layerBatchId`) REFERENCES `layer_batches`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sales` ADD CONSTRAINT `sales_batchId_fkey` FOREIGN KEY (`batchId`) REFERENCES `broiler_batches`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sales` ADD CONSTRAINT `sales_layerBatchId_fkey` FOREIGN KEY (`layerBatchId`) REFERENCES `layer_batches`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `layer_batches` ADD CONSTRAINT `layer_batches_farmId_fkey` FOREIGN KEY (`farmId`) REFERENCES `farms`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `layer_batches` ADD CONSTRAINT `layer_batches_buildingId_fkey` FOREIGN KEY (`buildingId`) REFERENCES `buildings`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `layer_batches` ADD CONSTRAINT `layer_batches_primaryManagerId_fkey` FOREIGN KEY (`primaryManagerId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `layer_daily_records` ADD CONSTRAINT `layer_daily_records_farmId_fkey` FOREIGN KEY (`farmId`) REFERENCES `farms`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `layer_daily_records` ADD CONSTRAINT `layer_daily_records_batchId_fkey` FOREIGN KEY (`batchId`) REFERENCES `layer_batches`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `layer_daily_records` ADD CONSTRAINT `layer_daily_records_operatorId_fkey` FOREIGN KEY (`operatorId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `layer_health_events` ADD CONSTRAINT `layer_health_events_farmId_fkey` FOREIGN KEY (`farmId`) REFERENCES `farms`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `layer_health_events` ADD CONSTRAINT `layer_health_events_batchId_fkey` FOREIGN KEY (`batchId`) REFERENCES `layer_batches`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `egg_stock_lots` ADD CONSTRAINT `egg_stock_lots_farmId_fkey` FOREIGN KEY (`farmId`) REFERENCES `farms`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `egg_stock_lots` ADD CONSTRAINT `egg_stock_lots_batchId_fkey` FOREIGN KEY (`batchId`) REFERENCES `layer_batches`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `egg_stock_lots` ADD CONSTRAINT `egg_stock_lots_dailyRecordId_fkey` FOREIGN KEY (`dailyRecordId`) REFERENCES `layer_daily_records`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `egg_stock_movements` ADD CONSTRAINT `egg_stock_movements_farmId_fkey` FOREIGN KEY (`farmId`) REFERENCES `farms`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `egg_stock_movements` ADD CONSTRAINT `egg_stock_movements_lotId_fkey` FOREIGN KEY (`lotId`) REFERENCES `egg_stock_lots`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `egg_stock_movements` ADD CONSTRAINT `egg_stock_movements_saleId_fkey` FOREIGN KEY (`saleId`) REFERENCES `sales`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
