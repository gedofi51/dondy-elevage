-- CreateTable
CREATE TABLE `broiler_batches` (
    `id` VARCHAR(191) NOT NULL,
    `farmId` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `productionType` VARCHAR(191) NOT NULL DEFAULT 'poulet_chair',
    `breed` VARCHAR(191) NULL,
    `arrivalDate` DATETIME(3) NOT NULL,
    `arrivalTime` VARCHAR(191) NULL,
    `origin` ENUM('ACHAT', 'NAISSANCE_INTERNE') NOT NULL,
    `supplierId` VARCHAR(191) NULL,
    `invoiceNumber` VARCHAR(191) NULL,
    `orderedQuantity` INTEGER NOT NULL,
    `receivedQuantity` INTEGER NOT NULL,
    `deadOnArrivalQuantity` INTEGER NOT NULL DEFAULT 0,
    `unitPriceFcfa` INTEGER NOT NULL,
    `transportCostFcfa` INTEGER NOT NULL DEFAULT 0,
    `otherCostsFcfa` INTEGER NOT NULL DEFAULT 0,
    `buildingId` VARCHAR(191) NOT NULL,
    `primaryManagerId` VARCHAR(191) NOT NULL,
    `plannedSaleDate` DATETIME(3) NOT NULL,
    `status` ENUM('BROUILLON', 'PLANIFIEE', 'EN_DEMARRAGE', 'EN_CROISSANCE', 'EN_FINITION', 'PRETE_A_VENDRE', 'EN_VENTE', 'VENDUE', 'CLOTUREE', 'ANNULEE') NOT NULL DEFAULT 'BROUILLON',
    `observations` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `createdBy` VARCHAR(191) NULL,

    INDEX `broiler_batches_farmId_idx`(`farmId`),
    INDEX `broiler_batches_farmId_status_idx`(`farmId`, `status`),
    UNIQUE INDEX `broiler_batches_farmId_code_key`(`farmId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `broiler_daily_records` (
    `id` VARCHAR(191) NOT NULL,
    `farmId` VARCHAR(191) NOT NULL,
    `batchId` VARCHAR(191) NOT NULL,
    `dayNumber` INTEGER NOT NULL,
    `date` DATETIME(3) NOT NULL,
    `operatorId` VARCHAR(191) NULL,
    `entryTime` VARCHAR(191) NULL,
    `mortalityQuantity` INTEGER NOT NULL DEFAULT 0,
    `cullsQuantity` INTEGER NOT NULL DEFAULT 0,
    `otherExitsQuantity` INTEGER NOT NULL DEFAULT 0,
    `feedType` VARCHAR(191) NULL,
    `feedDistributedKg` DECIMAL(8, 2) NULL,
    `feedRemainingKg` DECIMAL(8, 2) NULL,
    `feedBagsUsed` INTEGER NULL,
    `waterConsumptionLiters` DECIMAL(8, 2) NULL,
    `waterObservation` TEXT NULL,
    `sampleSize` INTEGER NULL,
    `totalSampleWeightG` INTEGER NULL,
    `averageWeightG` INTEGER NULL,
    `temperatureMinC` DECIMAL(4, 1) NULL,
    `temperatureMaxC` DECIMAL(4, 1) NULL,
    `temperatureNowC` DECIMAL(4, 1) NULL,
    `humidityPercent` DECIMAL(4, 1) NULL,
    `symptoms` TEXT NULL,
    `treatment` TEXT NULL,
    `vaccination` VARCHAR(191) NULL,
    `healthProduct` VARCHAR(191) NULL,
    `healthQuantity` VARCHAR(191) NULL,
    `healthResponsible` VARCHAR(191) NULL,
    `behaviorNormal` BOOLEAN NOT NULL DEFAULT false,
    `behaviorLowConsumption` BOOLEAN NOT NULL DEFAULT false,
    `behaviorAgitation` BOOLEAN NOT NULL DEFAULT false,
    `behaviorFlocking` BOOLEAN NOT NULL DEFAULT false,
    `behaviorLethargy` BOOLEAN NOT NULL DEFAULT false,
    `behaviorDiarrhea` BOOLEAN NOT NULL DEFAULT false,
    `behaviorRespiratoryDistress` BOOLEAN NOT NULL DEFAULT false,
    `behaviorOther` VARCHAR(191) NULL,
    `observations` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `broiler_daily_records_farmId_idx`(`farmId`),
    INDEX `broiler_daily_records_batchId_date_idx`(`batchId`, `date`),
    UNIQUE INDEX `broiler_daily_records_batchId_dayNumber_key`(`batchId`, `dayNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `broiler_mortalities` (
    `id` VARCHAR(191) NOT NULL,
    `farmId` VARCHAR(191) NOT NULL,
    `batchId` VARCHAR(191) NOT NULL,
    `date` DATETIME(3) NOT NULL,
    `dayNumber` INTEGER NOT NULL,
    `quantity` INTEGER NOT NULL,
    `cause` ENUM('INCONNUE', 'MALADIE', 'ACCIDENT', 'ETOUFFEMENT', 'CHALEUR', 'FROID', 'PROBLEME_ALIMENTAIRE', 'PROBLEME_EAU', 'PREDATEUR', 'AUTRE') NOT NULL DEFAULT 'INCONNUE',
    `observation` TEXT NULL,
    `recordedBy` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `broiler_mortalities_farmId_idx`(`farmId`),
    INDEX `broiler_mortalities_batchId_date_idx`(`batchId`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `broiler_health_events` (
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

    INDEX `broiler_health_events_farmId_idx`(`farmId`),
    INDEX `broiler_health_events_batchId_date_idx`(`batchId`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `expenses` (
    `id` VARCHAR(191) NOT NULL,
    `farmId` VARCHAR(191) NOT NULL,
    `batchId` VARCHAR(191) NULL,
    `date` DATETIME(3) NOT NULL,
    `category` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `quantity` DECIMAL(10, 2) NULL,
    `unitPriceFcfa` INTEGER NULL,
    `amountFcfa` INTEGER NOT NULL,
    `supplierId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `createdBy` VARCHAR(191) NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `expenses_farmId_idx`(`farmId`),
    INDEX `expenses_batchId_idx`(`batchId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sales` (
    `id` VARCHAR(191) NOT NULL,
    `farmId` VARCHAR(191) NOT NULL,
    `batchId` VARCHAR(191) NOT NULL,
    `saleNumber` VARCHAR(191) NOT NULL,
    `date` DATETIME(3) NOT NULL,
    `customerId` VARCHAR(191) NOT NULL,
    `sellerId` VARCHAR(191) NOT NULL,
    `saleMode` ENUM('UNITE', 'POIDS', 'LOT') NOT NULL,
    `quantity` INTEGER NOT NULL,
    `weightKg` DECIMAL(8, 2) NULL,
    `unitPriceFcfa` INTEGER NOT NULL,
    `discountFcfa` INTEGER NOT NULL DEFAULT 0,
    `grossAmountFcfa` INTEGER NOT NULL,
    `netAmountFcfa` INTEGER NOT NULL,
    `status` ENUM('BROUILLON', 'RESERVEE', 'CONFIRMEE', 'PAYEE', 'PARTIELLEMENT_PAYEE', 'IMPAYEE', 'ANNULEE') NOT NULL DEFAULT 'BROUILLON',
    `observation` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `createdBy` VARCHAR(191) NULL,

    INDEX `sales_farmId_idx`(`farmId`),
    INDEX `sales_batchId_idx`(`batchId`),
    INDEX `sales_farmId_status_idx`(`farmId`, `status`),
    UNIQUE INDEX `sales_farmId_saleNumber_key`(`farmId`, `saleNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payments` (
    `id` VARCHAR(191) NOT NULL,
    `farmId` VARCHAR(191) NOT NULL,
    `saleId` VARCHAR(191) NOT NULL,
    `date` DATETIME(3) NOT NULL,
    `method` VARCHAR(191) NOT NULL,
    `amountFcfa` INTEGER NOT NULL,
    `reference` VARCHAR(191) NULL,
    `observation` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdBy` VARCHAR(191) NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `payments_farmId_idx`(`farmId`),
    INDEX `payments_saleId_idx`(`saleId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `broiler_batches` ADD CONSTRAINT `broiler_batches_farmId_fkey` FOREIGN KEY (`farmId`) REFERENCES `farms`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `broiler_batches` ADD CONSTRAINT `broiler_batches_supplierId_fkey` FOREIGN KEY (`supplierId`) REFERENCES `suppliers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `broiler_batches` ADD CONSTRAINT `broiler_batches_buildingId_fkey` FOREIGN KEY (`buildingId`) REFERENCES `buildings`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `broiler_batches` ADD CONSTRAINT `broiler_batches_primaryManagerId_fkey` FOREIGN KEY (`primaryManagerId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `broiler_daily_records` ADD CONSTRAINT `broiler_daily_records_farmId_fkey` FOREIGN KEY (`farmId`) REFERENCES `farms`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `broiler_daily_records` ADD CONSTRAINT `broiler_daily_records_batchId_fkey` FOREIGN KEY (`batchId`) REFERENCES `broiler_batches`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `broiler_daily_records` ADD CONSTRAINT `broiler_daily_records_operatorId_fkey` FOREIGN KEY (`operatorId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `broiler_mortalities` ADD CONSTRAINT `broiler_mortalities_farmId_fkey` FOREIGN KEY (`farmId`) REFERENCES `farms`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `broiler_mortalities` ADD CONSTRAINT `broiler_mortalities_batchId_fkey` FOREIGN KEY (`batchId`) REFERENCES `broiler_batches`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `broiler_health_events` ADD CONSTRAINT `broiler_health_events_farmId_fkey` FOREIGN KEY (`farmId`) REFERENCES `farms`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `broiler_health_events` ADD CONSTRAINT `broiler_health_events_batchId_fkey` FOREIGN KEY (`batchId`) REFERENCES `broiler_batches`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `expenses` ADD CONSTRAINT `expenses_farmId_fkey` FOREIGN KEY (`farmId`) REFERENCES `farms`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `expenses` ADD CONSTRAINT `expenses_batchId_fkey` FOREIGN KEY (`batchId`) REFERENCES `broiler_batches`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `expenses` ADD CONSTRAINT `expenses_supplierId_fkey` FOREIGN KEY (`supplierId`) REFERENCES `suppliers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sales` ADD CONSTRAINT `sales_farmId_fkey` FOREIGN KEY (`farmId`) REFERENCES `farms`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sales` ADD CONSTRAINT `sales_batchId_fkey` FOREIGN KEY (`batchId`) REFERENCES `broiler_batches`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sales` ADD CONSTRAINT `sales_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `customers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sales` ADD CONSTRAINT `sales_sellerId_fkey` FOREIGN KEY (`sellerId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payments` ADD CONSTRAINT `payments_farmId_fkey` FOREIGN KEY (`farmId`) REFERENCES `farms`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payments` ADD CONSTRAINT `payments_saleId_fkey` FOREIGN KEY (`saleId`) REFERENCES `sales`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
