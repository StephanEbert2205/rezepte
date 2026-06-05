-- Einzelne Git-Commits, die der Admin einmalig als aufnehmen/überspringen bewertet.
CREATE TABLE IF NOT EXISTS changelog_commits (
  id          INT           AUTO_INCREMENT PRIMARY KEY,
  hash        VARCHAR(40)   NOT NULL UNIQUE            COMMENT 'Vollständiger Git-Hash',
  shortHash   VARCHAR(10)   NOT NULL DEFAULT ''        COMMENT 'Kurz-Hash (7 Zeichen)',
  message     TEXT          NOT NULL                   COMMENT 'Commit-Nachricht',
  commitDate  DATE          NOT NULL                   COMMENT 'Datum des Commits',
  author      VARCHAR(255)  NOT NULL DEFAULT ''        COMMENT 'Commit-Autor',
  deployTag   VARCHAR(20)   NOT NULL                   COMMENT 'Deploy-Zeitstempel YYYY-MM-DDTHH:MM',
  importedAt  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  isTechnical TINYINT(1)    NOT NULL DEFAULT 0         COMMENT '1 = auto als technisch erkannt',
  status      ENUM('pending','included','skipped') NOT NULL DEFAULT 'pending',
  entryId     INT           NULL                       COMMENT 'FK auf changelog_entries nach Entwurf-Erstellung',
  decidedAt   DATETIME      NULL,
  INDEX idx_status    (status),
  INDEX idx_deployTag (deployTag)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
