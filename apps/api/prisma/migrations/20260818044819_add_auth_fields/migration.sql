-- AlterTable
ALTER TABLE `refresh_tokens` ADD COLUMN `replacedByTokenHash` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `users` ADD COLUMN `emailVerificationExpiresAt` DATETIME(3) NULL,
    ADD COLUMN `emailVerificationTokenHash` VARCHAR(191) NULL,
    ADD COLUMN `emailVerified` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `passwordResetExpiresAt` DATETIME(3) NULL,
    ADD COLUMN `passwordResetTokenHash` VARCHAR(191) NULL,
    ADD COLUMN `twoFactorSecret` VARCHAR(191) NULL,
    MODIFY `passwordHash` VARCHAR(191) NULL,
    MODIFY `status` ENUM('INVITED', 'ACTIVE', 'INACTIVE', 'SUSPENDED') NOT NULL DEFAULT 'INVITED';
