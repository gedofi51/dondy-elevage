-- CreateTable
CREATE TABLE `employees` (
    `id` VARCHAR(191) NOT NULL,
    `farmId` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `buildingId` VARCHAR(191) NULL,
    `managerId` VARCHAR(191) NULL,
    `name` VARCHAR(191) NOT NULL,
    `position` VARCHAR(191) NOT NULL,
    `contractType` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `hireDate` DATETIME(3) NOT NULL,
    `endDate` DATETIME(3) NULL,
    `status` ENUM('ACTIF', 'CONGE', 'SUSPENDU', 'DEPART') NOT NULL DEFAULT 'ACTIF',
    `baseSalaryFcfa` INTEGER NOT NULL,
    `observations` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `createdBy` VARCHAR(191) NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `employees_farmId_idx`(`farmId`),
    INDEX `employees_farmId_status_idx`(`farmId`, `status`),
    UNIQUE INDEX `employees_farmId_code_key`(`farmId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `attendances` (
    `id` VARCHAR(191) NOT NULL,
    `farmId` VARCHAR(191) NOT NULL,
    `employeeId` VARCHAR(191) NOT NULL,
    `date` DATETIME(3) NOT NULL,
    `status` ENUM('PRESENT', 'ABSENT', 'CONGE', 'MALADIE') NOT NULL,
    `checkInTime` VARCHAR(191) NULL,
    `checkOutTime` VARCHAR(191) NULL,
    `observations` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `createdBy` VARCHAR(191) NULL,

    INDEX `attendances_farmId_idx`(`farmId`),
    INDEX `attendances_employeeId_idx`(`employeeId`),
    UNIQUE INDEX `attendances_employeeId_date_key`(`employeeId`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `employee_tasks` (
    `id` VARCHAR(191) NOT NULL,
    `farmId` VARCHAR(191) NOT NULL,
    `employeeId` VARCHAR(191) NOT NULL,
    `designation` VARCHAR(191) NOT NULL,
    `dueDate` DATETIME(3) NOT NULL,
    `status` ENUM('A_FAIRE', 'EN_COURS', 'REALISEE', 'ANNULEE') NOT NULL DEFAULT 'A_FAIRE',
    `cancelReason` VARCHAR(191) NULL,
    `observations` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `createdBy` VARCHAR(191) NULL,

    INDEX `employee_tasks_farmId_idx`(`farmId`),
    INDEX `employee_tasks_farmId_status_idx`(`farmId`, `status`),
    INDEX `employee_tasks_employeeId_idx`(`employeeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payrolls` (
    `id` VARCHAR(191) NOT NULL,
    `farmId` VARCHAR(191) NOT NULL,
    `employeeId` VARCHAR(191) NOT NULL,
    `periodStart` DATETIME(3) NOT NULL,
    `periodEnd` DATETIME(3) NOT NULL,
    `baseSalaryFcfa` INTEGER NOT NULL,
    `bonusFcfa` INTEGER NOT NULL DEFAULT 0,
    `deductionsFcfa` INTEGER NOT NULL DEFAULT 0,
    `netFcfa` INTEGER NOT NULL,
    `status` ENUM('BROUILLON', 'VALIDE') NOT NULL DEFAULT 'BROUILLON',
    `observations` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `createdBy` VARCHAR(191) NULL,

    INDEX `payrolls_farmId_idx`(`farmId`),
    INDEX `payrolls_employeeId_idx`(`employeeId`),
    UNIQUE INDEX `payrolls_employeeId_periodStart_key`(`employeeId`, `periodStart`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `salary_advances` (
    `id` VARCHAR(191) NOT NULL,
    `farmId` VARCHAR(191) NOT NULL,
    `employeeId` VARCHAR(191) NOT NULL,
    `deductedInPayrollId` VARCHAR(191) NULL,
    `date` DATETIME(3) NOT NULL,
    `amountFcfa` INTEGER NOT NULL,
    `observations` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `createdBy` VARCHAR(191) NULL,

    INDEX `salary_advances_farmId_idx`(`farmId`),
    INDEX `salary_advances_employeeId_idx`(`employeeId`),
    INDEX `salary_advances_deductedInPayrollId_idx`(`deductedInPayrollId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `employees` ADD CONSTRAINT `employees_farmId_fkey` FOREIGN KEY (`farmId`) REFERENCES `farms`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employees` ADD CONSTRAINT `employees_buildingId_fkey` FOREIGN KEY (`buildingId`) REFERENCES `buildings`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employees` ADD CONSTRAINT `employees_managerId_fkey` FOREIGN KEY (`managerId`) REFERENCES `employees`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendances` ADD CONSTRAINT `attendances_farmId_fkey` FOREIGN KEY (`farmId`) REFERENCES `farms`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendances` ADD CONSTRAINT `attendances_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `employees`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_tasks` ADD CONSTRAINT `employee_tasks_farmId_fkey` FOREIGN KEY (`farmId`) REFERENCES `farms`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_tasks` ADD CONSTRAINT `employee_tasks_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `employees`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payrolls` ADD CONSTRAINT `payrolls_farmId_fkey` FOREIGN KEY (`farmId`) REFERENCES `farms`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payrolls` ADD CONSTRAINT `payrolls_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `employees`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `salary_advances` ADD CONSTRAINT `salary_advances_farmId_fkey` FOREIGN KEY (`farmId`) REFERENCES `farms`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `salary_advances` ADD CONSTRAINT `salary_advances_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `employees`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `salary_advances` ADD CONSTRAINT `salary_advances_deductedInPayrollId_fkey` FOREIGN KEY (`deductedInPayrollId`) REFERENCES `payrolls`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
