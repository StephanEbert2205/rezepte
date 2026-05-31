-- Datenbank und Benutzer für Rezept-App anlegen
-- Als root ausführen: mysql -u root < create-database.sql

CREATE DATABASE IF NOT EXISTS rezepte
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

-- Benutzer bereits vorhanden laut Zugangsdaten
-- Falls neu anlegen:
-- CREATE USER IF NOT EXISTS 'claude_rezepte'@'localhost' IDENTIFIED BY 'TM.SgOobMlOjX5H*';
-- GRANT ALL PRIVILEGES ON rezepte.* TO 'claude_rezepte'@'localhost';
-- FLUSH PRIVILEGES;

GRANT ALL PRIVILEGES ON rezepte.* TO 'claude_rezepte'@'localhost';
FLUSH PRIVILEGES;

SELECT 'Datenbank erfolgreich eingerichtet.' AS Status;
