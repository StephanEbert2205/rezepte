-- Letzter Changelog-Lesezeitstempel pro Nutzer
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS lastChangelogReadAt DATETIME NULL
  COMMENT 'Zeitpunkt, zu dem der Nutzer zuletzt den Changelog angesehen hat';
