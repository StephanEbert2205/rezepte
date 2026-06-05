-- ============================================================
--  migrate-admin.sql  (idempotent)
--  Fügt das isAdmin-Flag zur users-Tabelle hinzu.
--  Aufruf:  node deploy.js --migrate-admin
-- ============================================================

ALTER TABLE `users`
    ADD COLUMN IF NOT EXISTS `isAdmin` TINYINT(1) NOT NULL DEFAULT 0;

-- Index für schnelle Admin-Suche (optional, Tabelle ist klein)
ALTER TABLE `users`
    ADD INDEX IF NOT EXISTS `idx_admin` (`isAdmin`);

-- Ersten Admin manuell setzen:
--   UPDATE `users` SET `isAdmin` = 1 WHERE `email` = 'deine@email.de';
