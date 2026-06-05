-- KI-generierte Changelog-Entwürfe: Spalte zur Unterscheidung von manuellen Einträgen
ALTER TABLE changelog_entries
  ADD COLUMN IF NOT EXISTS isAiGenerated TINYINT(1) NOT NULL DEFAULT 0
  COMMENT '1 = automatisch vom KI-Modell generiert, noch nicht vom Admin freigegeben';
