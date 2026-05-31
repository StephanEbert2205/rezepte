@echo off
echo ============================================
echo  Rezept-App - Entwicklungsmodus
echo ============================================
echo.

SET NODE_PATH=C:\xampp-php81\nodejs
SET PATH=%NODE_PATH%;%PATH%

echo [1/2] Starte Backend auf Port 3001...
start "Rezept-Backend" cmd /k "cd /d %~dp0backend && %NODE_PATH%\node.exe ..\node_modules\ts-node-dev\lib\bin.js --respawn --transpile-only src/index.ts"

echo [2/2] Starte Frontend auf Port 5173...
timeout /t 3 /nobreak >nul
start "Rezept-Frontend" cmd /k "cd /d %~dp0frontend && %NODE_PATH%\node.exe ..\node_modules\vite\bin\vite.js"

echo.
echo Backend:  http://localhost:3001
echo Frontend: http://localhost:5173
echo.
echo Beide Fenster schliessen zum Beenden.
pause
