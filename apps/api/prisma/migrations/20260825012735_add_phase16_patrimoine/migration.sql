-- AlterTable
ALTER TABLE `expenses` ADD COLUMN `assetId` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `assets` (
    `id` VARCHAR(191) NOT NULL,
    `farmId` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `designation` VARCHAR(191) NOT NULL,
    `category` VARCHAR(191) NOT NULL,
    `brand` VARCHAR(191) NULL,
    `model` VARCHAR(191) NULL,
    `serialNumber` VARCHAR(191) NULL,
    `supplierId` VARCHAR(191) NULL,
    `purchaseDate` DATETIME(3) NOT NULL,
    `serviceDate` DATETIME(3) NOT NULL,
    `purchasePriceFcfa` INTEGER NOT NULL,
    `installationCostFcfa` INTEGER NOT NULL DEFAULT 0,
    `location` VARCHAR(191) NULL,
    `responsibleId` VARCHAR(191) NOT NULL,
    `status` ENUM('ACTIF', 'HORS_SERVICE', 'REFORME') NOT NULL DEFAULT 'ACTIF',
    `warrantyExpiresAt` DATETIME(3) NULL,
    `residualValueFcfa` INTEGER NOT NULL DEFAULT 0,
    `depreciationMethod` ENUM('LINEAIRE') NOT NULL DEFAULT 'LINEAIRE',
    `depreciationDurationYears` INTEGER NOT NULL,
    `reformDate` DATETIME(3) NULL,
    `reformReason` VARCHAR(191) NULL,
    `observations` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `createdBy` VARCHAR(191) NULL,

    INDEX `assets_farmId_idx`(`farmId`),
    INDEX `assets_farmId_status_idx`(`farmId`, `status`),
    UNIQUE INDEX `assets_farmId_code_key`(`farmId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `depreciation_entries` (
    `id` VARCHAR(191) NOT NULL,
    `farmId` VARCHAR(191) NOT NULL,
    `assetId` VARCHAR(191) NOT NULL,
    `periodNumber` INTEGER NOT NULL,
    `periodStart` DATETIME(3) NOT NULL,
    `periodEnd` DATETIME(3) NOT NULL,
    `dotationFcfa` INTEGER NOT NULL,
    `cumulativeFcfa` INTEGER NOT NULL,
    `netBookValueFcfa` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `depreciation_entries_farmId_idx`(`farmId`),
    INDEX `depreciation_entries_assetId_idx`(`assetId`),
    UNIQUE INDEX `depreciation_entries_assetId_periodNumber_key`(`assetId`, `periodNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `expenses_assetId_idx` ON `expenses`(`assetId`);

-- AddForeignKey
ALTER TABLE `expenses` ADD CONSTRAINT `expenses_assetId_fkey` FOREIGN KEY (`assetId`) REFERENCES `assets`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `assets` ADD CONSTRAINT `assets_farmId_fkey` FOREIGN KEY (`farmId`) REFERENCES `farms`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `assets` ADD CONSTRAINT `assets_supplierId_fkey` FOREIGN KEY (`supplierId`) REFERENCES `suppliers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `assets` ADD CONSTRAINT `assets_responsibleId_fkey` FOREIGN KEY (`responsibleId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `depreciation_entries` ADD CONSTRAINT `depreciation_entries_farmId_fkey` FOREIGN KEY (`farmId`) REFERENCES `farms`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `depreciation_entries` ADD CONSTRAINT `depreciation_entries_assetId_fkey` FOREIGN KEY (`assetId`) REFERENCES `assets`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
