-- Changelog-Einträge: vom Admin verwaltete App-Updates
CREATE TABLE IF NOT EXISTS changelog_entries (
  id            INT          AUTO_INCREMENT PRIMARY KEY,
  version       VARCHAR(50)  NULL                COMMENT 'z.B. 1.4.0 (optional)',
  releaseDate   DATE         NOT NULL            COMMENT 'Veröffentlichungsdatum',
  title         VARCHAR(255) NOT NULL            COMMENT 'Überschrift',
  body          TEXT         NOT NULL DEFAULT '' COMMENT 'Freitext – eine Änderung pro Zeile',
  isPublished   TINYINT(1)   NOT NULL DEFAULT 0  COMMENT '0=Entwurf, 1=öffentlich',
  gitHash       VARCHAR(40)  NULL                COMMENT 'HEAD-Hash beim Erstellen (für Referenz)',
  createdAt     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
