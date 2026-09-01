-- CreateTable
CREATE TABLE `qr_codes` (
    `id` VARCHAR(191) NOT NULL,
    `farmId` VARCHAR(191) NOT NULL,
    `entityType` ENUM('BROILER_BATCH', 'LAYER_BATCH', 'ASSET', 'ITEM') NOT NULL,
    `entityId` VARCHAR(191) NOT NULL,
    `tokenHash` VARCHAR(191) NOT NULL,
    `revokedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdBy` VARCHAR(191) NULL,

    UNIQUE INDEX `qr_codes_tokenHash_key`(`tokenHash`),
    INDEX `qr_codes_farmId_idx`(`farmId`),
    INDEX `qr_codes_entityType_entityId_idx`(`entityType`, `entityId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `qr_code_scans` (
    `id` VARCHAR(191) NOT NULL,
    `farmId` VARCHAR(191) NOT NULL,
    `qrCodeId` VARCHAR(191) NOT NULL,
    `scannedByUserId` VARCHAR(191) NULL,
    `ipAddress` VARCHAR(191) NULL,
    `scannedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `qr_code_scans_farmId_idx`(`farmId`),
    INDEX `qr_code_scans_qrCodeId_idx`(`qrCodeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `qr_codes` ADD CONSTRAINT `qr_codes_farmId_fkey` FOREIGN KEY (`farmId`) REFERENCES `farms`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `qr_code_scans` ADD CONSTRAINT `qr_code_scans_farmId_fkey` FOREIGN KEY (`farmId`) REFERENCES `farms`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `qr_code_scans` ADD CONSTRAINT `qr_code_scans_qrCodeId_fkey` FOREIGN KEY (`qrCodeId`) REFERENCES `qr_codes`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `qr_code_scans` ADD CONSTRAINT `qr_code_scans_scannedByUserId_fkey` FOREIGN KEY (`scannedByUserId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
