@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
title Memories of the Past - DEV

echo ====================================================
echo   MOTP DEV MODE (client HMR + server --watch)
echo ====================================================
echo.

where node >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Node.js not found.
    echo         Install Node.js 24.18.0+ from https://nodejs.org/
    echo.
    pause
    exit /b 1
)

if not exist "node_modules" (
    echo [SETUP] Installing dependencies ^(first run only^)...
    call npm install
    if errorlevel 1 (
        echo [ERROR] npm install failed. Check your internet connection.
        pause
        exit /b 1
    )
)

echo [START] Opening server + client in separate windows...
start "MOTP server (dev)" cmd /k npm run dev:server
start "MOTP client (dev)" cmd /k npm run dev:client

timeout /t 3 >nul
start "" "http://localhost:5173"

echo.
echo [INFO] Two windows opened: server (:5000) and client (:5173).
echo        Close both windows to stop dev mode.
echo.
pause
