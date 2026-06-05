-- ============================================================
--  migrate-reports.sql  (idempotent)
--  Legt die recipe_reports-Tabelle an.
--  Aufruf:  node deploy.js --migrate-reports
-- ============================================================

CREATE TABLE IF NOT EXISTS `recipe_reports` (
    `id`         INT          NOT NULL AUTO_INCREMENT,
    `recipeId`   INT          NOT NULL,
    `userId`     INT          NOT NULL,
    `categories` VARCHAR(512) NOT NULL,            -- kommagetrennte Kategorien
    `comment`    TEXT,
    `status`     ENUM('open','resolved') NOT NULL DEFAULT 'open',
    `createdAt`  DATETIME     NOT NULL,
    `resolvedAt` DATETIME,
    PRIMARY KEY (`id`),
    INDEX `idx_recipe`  (`recipeId`),
    INDEX `idx_status`  (`status`),
    CONSTRAINT `fk_report_recipe` FOREIGN KEY (`recipeId`)
        REFERENCES `recipes`  (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_report_user`   FOREIGN KEY (`userId`)
        REFERENCES `users`    (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
