-- ============================================================
--  migrate-invitations.sql  (idempotent)
--  Fügt die account_invitations-Tabelle hinzu.
--  Aufruf:  node deploy.js --migrate-invitations
-- ============================================================

CREATE TABLE IF NOT EXISTS `account_invitations` (
    `id`        INT          NOT NULL AUTO_INCREMENT,
    `inviterId` INT          NOT NULL,
    `email`     VARCHAR(255) NOT NULL,
    `token`     VARCHAR(64)  NOT NULL,
    `expiresAt` DATETIME     NOT NULL,
    `createdAt` DATETIME     NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_token`     (`token`),
    UNIQUE KEY `uq_inv_email` (`inviterId`, `email`),
    INDEX       `idx_expires` (`expiresAt`),
    CONSTRAINT  `fk_inv_inviter` FOREIGN KEY (`inviterId`)
        REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Bereits abgelaufene Einladungen sofort entfernen
DELETE FROM `account_invitations` WHERE `expiresAt` < NOW();
