-- AlterTable
ALTER TABLE `stock_movements` MODIFY `reason` ENUM('ACHAT', 'RETOUR', 'AJUSTEMENT', 'PRODUCTION_INTERNE', 'DISTRIBUTION_BANDE', 'VENTE', 'PERTE', 'CASSE', 'CONSOMMATION_INTERNE', 'MAINTENANCE') NOT NULL;

-- CreateTable
CREATE TABLE `maintenance_plans` (
    `id` VARCHAR(191) NOT NULL,
    `farmId` VARCHAR(191) NOT NULL,
    `assetId` VARCHAR(191) NOT NULL,
    `designation` VARCHAR(191) NOT NULL,
    `periodicityDays` INTEGER NOT NULL,
    `startDate` DATETIME(3) NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `observations` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `createdBy` VARCHAR(191) NULL,

    INDEX `maintenance_plans_farmId_idx`(`farmId`),
    INDEX `maintenance_plans_farmId_active_idx`(`farmId`, `active`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `maintenance_tasks` (
    `id` VARCHAR(191) NOT NULL,
    `farmId` VARCHAR(191) NOT NULL,
    `assetId` VARCHAR(191) NOT NULL,
    `planId` VARCHAR(191) NULL,
    `type` ENUM('PREVENTIVE', 'CORRECTIVE', 'CONDITIONNELLE') NOT NULL,
    `designation` VARCHAR(191) NOT NULL,
    `dueDate` DATETIME(3) NOT NULL,
    `status` ENUM('A_FAIRE', 'EN_COURS', 'REALISEE', 'ANNULEE') NOT NULL DEFAULT 'A_FAIRE',
    `cancelReason` VARCHAR(191) NULL,
    `observations` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `createdBy` VARCHAR(191) NULL,

    INDEX `maintenance_tasks_farmId_idx`(`farmId`),
    INDEX `maintenance_tasks_farmId_status_idx`(`farmId`, `status`),
    INDEX `maintenance_tasks_planId_idx`(`planId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `maintenance_interventions` (
    `id` VARCHAR(191) NOT NULL,
    `farmId` VARCHAR(191) NOT NULL,
    `assetId` VARCHAR(191) NOT NULL,
    `taskId` VARCHAR(191) NULL,
    `interventionDate` DATETIME(3) NOT NULL,
    `diagnosis` TEXT NULL,
    `laborCostFcfa` INTEGER NOT NULL DEFAULT 0,
    `performedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdBy` VARCHAR(191) NULL,

    INDEX `maintenance_interventions_farmId_idx`(`farmId`),
    INDEX `maintenance_interventions_assetId_idx`(`assetId`),
    INDEX `maintenance_interventions_taskId_idx`(`taskId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `maintenance_plans` ADD CONSTRAINT `maintenance_plans_farmId_fkey` FOREIGN KEY (`farmId`) REFERENCES `farms`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `maintenance_plans` ADD CONSTRAINT `maintenance_plans_assetId_fkey` FOREIGN KEY (`assetId`) REFERENCES `assets`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `maintenance_tasks` ADD CONSTRAINT `maintenance_tasks_farmId_fkey` FOREIGN KEY (`farmId`) REFERENCES `farms`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `maintenance_tasks` ADD CONSTRAINT `maintenance_tasks_assetId_fkey` FOREIGN KEY (`assetId`) REFERENCES `assets`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `maintenance_tasks` ADD CONSTRAINT `maintenance_tasks_planId_fkey` FOREIGN KEY (`planId`) REFERENCES `maintenance_plans`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `maintenance_interventions` ADD CONSTRAINT `maintenance_interventions_farmId_fkey` FOREIGN KEY (`farmId`) REFERENCES `farms`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `maintenance_interventions` ADD CONSTRAINT `maintenance_interventions_assetId_fkey` FOREIGN KEY (`assetId`) REFERENCES `assets`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `maintenance_interventions` ADD CONSTRAINT `maintenance_interventions_taskId_fkey` FOREIGN KEY (`taskId`) REFERENCES `maintenance_tasks`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
