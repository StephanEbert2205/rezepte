-- =============================================================================
-- migrate-sharing.sql
-- Erweitert die Rezept-DB um Nutzer-Isolation, Rezept-Freigaben & Kontoverknüpfung.
--
-- Ausführen (lokal):
--   mysql -h localhost -u claude_rezepte -p'TM.SgOobMlOjX5H*' rezepte < setup/migrate-sharing.sql
-- Ausführen (Produktion via deploy.js):
--   node deploy.js --migrate
-- =============================================================================

-- 1. UNIQUE auf sourceUrl entfernen → mehrere Nutzer dürfen dieselbe URL importieren
SET @idx := (SELECT COUNT(*) FROM information_schema.STATISTICS
             WHERE TABLE_SCHEMA = DATABASE()
               AND TABLE_NAME  = 'recipes'
               AND INDEX_NAME  = 'recipes_sourceUrl_key');
SET @sql := IF(@idx > 0,
    'ALTER TABLE `recipes` DROP INDEX `recipes_sourceUrl_key`',
    'SELECT ''sourceUrl-Index bereits entfernt'' AS info');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 2. userId-Spalte auf recipes (nullable, wird unten befüllt)
SET @col := (SELECT COUNT(*) FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE()
               AND TABLE_NAME   = 'recipes'
               AND COLUMN_NAME  = 'userId');
SET @sql2 := IF(@col = 0,
    'ALTER TABLE `recipes` ADD COLUMN `userId` INT NULL AFTER `id`, ADD INDEX `idx_recipes_userId` (`userId`)',
    'SELECT ''userId-Spalte existiert bereits'' AS info');
PREPARE stmt FROM @sql2; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 3. FK recipes.userId → users.id (nur anlegen wenn noch nicht vorhanden)
SET @fk := (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
            WHERE CONSTRAINT_SCHEMA = DATABASE()
              AND TABLE_NAME        = 'recipes'
              AND CONSTRAINT_NAME   = 'fk_recipes_userId');
SET @sql3 := IF(@fk = 0,
    'ALTER TABLE `recipes` ADD CONSTRAINT `fk_recipes_userId` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE SET NULL',
    'SELECT ''FK fk_recipes_userId existiert bereits'' AS info');
PREPARE stmt FROM @sql3; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 4. Bestehende Rezepte (userId = NULL) dem ersten Nutzer zuweisen
UPDATE `recipes`
SET `userId` = (SELECT `id` FROM `users` ORDER BY `id` LIMIT 1)
WHERE `userId` IS NULL
  AND (SELECT COUNT(*) FROM `users`) > 0;

-- 5. Tabelle recipe_share_tokens (Freigabe-Link → Kopie)
CREATE TABLE IF NOT EXISTS `recipe_share_tokens` (
  `id`        INT AUTO_INCREMENT PRIMARY KEY,
  `recipeId`  INT NOT NULL,
  `userId`    INT NOT NULL,
  `token`     VARCHAR(64) NOT NULL,
  `createdAt` DATETIME NOT NULL,
  `expiresAt` DATETIME NULL,
  UNIQUE KEY `uq_share_token` (`token`),
  FOREIGN KEY (`recipeId`) REFERENCES `recipes` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`userId`)   REFERENCES `users`   (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Tabelle recipe_shares (direkte Freigabe, lese oder schreib)
CREATE TABLE IF NOT EXISTS `recipe_shares` (
  `id`           INT AUTO_INCREMENT PRIMARY KEY,
  `recipeId`     INT NOT NULL,
  `ownerId`      INT NOT NULL,
  `sharedWithId` INT NOT NULL,
  `canEdit`      TINYINT(1) NOT NULL DEFAULT 0,
  `createdAt`    DATETIME NOT NULL,
  UNIQUE KEY `uq_recipe_share` (`recipeId`, `sharedWithId`),
  FOREIGN KEY (`recipeId`)     REFERENCES `recipes` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`ownerId`)      REFERENCES `users`   (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`sharedWithId`) REFERENCES `users`   (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Tabelle account_links (Kontoverknüpfung)
CREATE TABLE IF NOT EXISTS `account_links` (
  `id`          INT AUTO_INCREMENT PRIMARY KEY,
  `requesterId` INT NOT NULL,
  `accepterId`  INT NOT NULL,
  `status`      ENUM('pending','accepted') NOT NULL DEFAULT 'pending',
  `createdAt`   DATETIME NOT NULL,
  UNIQUE KEY `uq_account_link` (`requesterId`, `accepterId`),
  FOREIGN KEY (`requesterId`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`accepterId`)  REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
