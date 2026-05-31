@echo off
echo ============================================
echo  Rezept-App - Installation
echo ============================================
echo.

SET NODE_PATH=C:\xampp-php81\nodejs
SET PATH=%NODE_PATH%;%PATH%

echo [1/4] Node.js Version prüfen...
%NODE_PATH%\node.exe --version
%NODE_PATH%\npm.cmd --version
echo.

echo [2/4] Backend-Pakete installieren...
cd /d %~dp0..\backend
%NODE_PATH%\npm.cmd install
IF ERRORLEVEL 1 (
    echo FEHLER: Backend-Installation fehlgeschlagen
    pause
    exit /b 1
)
echo.

echo [3/4] Frontend-Pakete installieren...
cd /d %~dp0..\frontend
%NODE_PATH%\npm.cmd install
IF ERRORLEVEL 1 (
    echo FEHLER: Frontend-Installation fehlgeschlagen
    pause
    exit /b 1
)
echo.

echo [4/4] Prisma-Client generieren und Datenbank migrieren...
cd /d %~dp0..\backend
%NODE_PATH%\node.exe node_modules\.bin\prisma db push
IF ERRORLEVEL 1 (
    echo FEHLER: Datenbank-Migration fehlgeschlagen.
    echo Bitte prüfe:
    echo  - Läuft MySQL in XAMPP?
    echo  - Existiert die Datenbank 'rezepte'?
    echo  - Sind die Zugangsdaten in backend\.env korrekt?
    pause
    exit /b 1
)
echo.

echo ============================================
echo  Installation abgeschlossen!
echo ============================================
echo.
echo Starten mit: start-dev.bat
echo.
pause
