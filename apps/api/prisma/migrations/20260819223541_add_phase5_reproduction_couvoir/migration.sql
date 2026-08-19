-- AlterTable
ALTER TABLE `expenses` ADD COLUMN `chickBatchId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `sales` ADD COLUMN `chickBatchId` VARCHAR(191) NULL,
    MODIFY `productType` ENUM('POULET_CHAIR', 'OEUFS', 'POUSSINS') NOT NULL DEFAULT 'POULET_CHAIR';

-- CreateTable
CREATE TABLE `incubators` (
    `id` VARCHAR(191) NOT NULL,
    `farmId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `capacityEggs` INTEGER NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `createdBy` VARCHAR(191) NULL,

    INDEX `incubators_farmId_idx`(`farmId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `breeder_batches` (
    `id` VARCHAR(191) NOT NULL,
    `farmId` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `strain` VARCHAR(191) NULL,
    `constitutionDate` DATETIME(3) NOT NULL,
    `femaleCount` INTEGER NOT NULL,
    `maleCount` INTEGER NOT NULL,
    `buildingId` VARCHAR(191) NOT NULL,
    `primaryManagerId` VARCHAR(191) NOT NULL,
    `status` ENUM('ACTIF', 'REFORME', 'CLOTURE', 'ANNULEE') NOT NULL DEFAULT 'ACTIF',
    `observations` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `createdBy` VARCHAR(191) NULL,

    INDEX `breeder_batches_farmId_idx`(`farmId`),
    INDEX `breeder_batches_farmId_status_idx`(`farmId`, `status`),
    UNIQUE INDEX `breeder_batches_farmId_code_key`(`farmId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `breeder_daily_records` (
    `id` VARCHAR(191) NOT NULL,
    `farmId` VARCHAR(191) NOT NULL,
    `batchId` VARCHAR(191) NOT NULL,
    `date` DATETIME(3) NOT NULL,
    `operatorId` VARCHAR(191) NULL,
    `eggsLaid` INTEGER NOT NULL,
    `eggsSelectedForIncubation` INTEGER NOT NULL DEFAULT 0,
    `eggsRejected` INTEGER NOT NULL DEFAULT 0,
    `eggsSold` INTEGER NOT NULL DEFAULT 0,
    `observations` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `breeder_daily_records_farmId_idx`(`farmId`),
    INDEX `breeder_daily_records_batchId_date_idx`(`batchId`, `date`),
    UNIQUE INDEX `breeder_daily_records_batchId_date_key`(`batchId`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `incubation_batches` (
    `id` VARCHAR(191) NOT NULL,
    `farmId` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `breederBatchId` VARCHAR(191) NOT NULL,
    `incubatorId` VARCHAR(191) NOT NULL,
    `incubationStartDate` DATETIME(3) NOT NULL,
    `eggCount` INTEGER NOT NULL,
    `actualHatchDate` DATETIME(3) NULL,
    `eggsInfertile` INTEGER NULL,
    `eggsInfected` INTEGER NULL,
    `embryonicMortality` INTEGER NULL,
    `chicksHatched` INTEGER NULL,
    `remarks` TEXT NULL,
    `status` ENUM('EN_INCUBATION', 'ECLOS', 'CLOTURE', 'ANNULEE') NOT NULL DEFAULT 'EN_INCUBATION',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `createdBy` VARCHAR(191) NULL,

    INDEX `incubation_batches_farmId_idx`(`farmId`),
    INDEX `incubation_batches_breederBatchId_idx`(`breederBatchId`),
    INDEX `incubation_batches_farmId_status_idx`(`farmId`, `status`),
    UNIQUE INDEX `incubation_batches_farmId_code_key`(`farmId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `chick_batches` (
    `id` VARCHAR(191) NOT NULL,
    `farmId` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `purpose` ENUM('VENTE', 'RENOUVELLEMENT') NOT NULL,
    `initialQuantity` INTEGER NOT NULL,
    `buildingId` VARCHAR(191) NULL,
    `status` ENUM('ACTIF', 'CLOTURE', 'ANNULE') NOT NULL DEFAULT 'ACTIF',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `createdBy` VARCHAR(191) NULL,

    INDEX `chick_batches_farmId_idx`(`farmId`),
    UNIQUE INDEX `chick_batches_farmId_code_key`(`farmId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `batch_lineage` (
    `id` VARCHAR(191) NOT NULL,
    `farmId` VARCHAR(191) NOT NULL,
    `incubationBatchId` VARCHAR(191) NOT NULL,
    `transformationType` ENUM('VENTE', 'CHAIR', 'RENOUVELLEMENT', 'REFORME_PERTE') NOT NULL,
    `quantity` INTEGER NOT NULL,
    `childType` VARCHAR(191) NULL,
    `childId` VARCHAR(191) NULL,
    `reason` TEXT NULL,
    `date` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdBy` VARCHAR(191) NOT NULL,

    INDEX `batch_lineage_farmId_idx`(`farmId`),
    INDEX `batch_lineage_incubationBatchId_idx`(`incubationBatchId`),
    INDEX `batch_lineage_childType_childId_idx`(`childType`, `childId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `expenses_chickBatchId_idx` ON `expenses`(`chickBatchId`);

-- CreateIndex
CREATE INDEX `sales_chickBatchId_idx` ON `sales`(`chickBatchId`);

-- AddForeignKey
ALTER TABLE `expenses` ADD CONSTRAINT `expenses_chickBatchId_fkey` FOREIGN KEY (`chickBatchId`) REFERENCES `chick_batches`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sales` ADD CONSTRAINT `sales_chickBatchId_fkey` FOREIGN KEY (`chickBatchId`) REFERENCES `chick_batches`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `incubators` ADD CONSTRAINT `incubators_farmId_fkey` FOREIGN KEY (`farmId`) REFERENCES `farms`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `breeder_batches` ADD CONSTRAINT `breeder_batches_farmId_fkey` FOREIGN KEY (`farmId`) REFERENCES `farms`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `breeder_batches` ADD CONSTRAINT `breeder_batches_buildingId_fkey` FOREIGN KEY (`buildingId`) REFERENCES `buildings`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `breeder_batches` ADD CONSTRAINT `breeder_batches_primaryManagerId_fkey` FOREIGN KEY (`primaryManagerId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `breeder_daily_records` ADD CONSTRAINT `breeder_daily_records_farmId_fkey` FOREIGN KEY (`farmId`) REFERENCES `farms`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `breeder_daily_records` ADD CONSTRAINT `breeder_daily_records_batchId_fkey` FOREIGN KEY (`batchId`) REFERENCES `breeder_batches`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `breeder_daily_records` ADD CONSTRAINT `breeder_daily_records_operatorId_fkey` FOREIGN KEY (`operatorId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `incubation_batches` ADD CONSTRAINT `incubation_batches_farmId_fkey` FOREIGN KEY (`farmId`) REFERENCES `farms`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `incubation_batches` ADD CONSTRAINT `incubation_batches_breederBatchId_fkey` FOREIGN KEY (`breederBatchId`) REFERENCES `breeder_batches`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `incubation_batches` ADD CONSTRAINT `incubation_batches_incubatorId_fkey` FOREIGN KEY (`incubatorId`) REFERENCES `incubators`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chick_batches` ADD CONSTRAINT `chick_batches_farmId_fkey` FOREIGN KEY (`farmId`) REFERENCES `farms`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chick_batches` ADD CONSTRAINT `chick_batches_buildingId_fkey` FOREIGN KEY (`buildingId`) REFERENCES `buildings`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `batch_lineage` ADD CONSTRAINT `batch_lineage_farmId_fkey` FOREIGN KEY (`farmId`) REFERENCES `farms`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `batch_lineage` ADD CONSTRAINT `batch_lineage_incubationBatchId_fkey` FOREIGN KEY (`incubationBatchId`) REFERENCES `incubation_batches`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
