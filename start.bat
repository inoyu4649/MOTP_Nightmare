@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
title Memories of the Past - TIMES Nightmare

echo ====================================================
echo   2026 HAFS Festival x TIMES : Nightmare (MOTP)
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

echo [BUILD] Building client...
call npm run build:client
if errorlevel 1 (
    echo [ERROR] Client build failed.
    pause
    exit /b 1
)

echo.
echo [START] Server starting... browser will open automatically.
echo [INFO ] Keep this window open. Close it to stop the server.
echo.

call npm run start

pause
