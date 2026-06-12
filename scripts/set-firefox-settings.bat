@echo off
REM Firefox Configuration Script for A/V Performance
REM Cross-platform script that creates user.js with optimal settings
REM 
REM Usage: Double-click this file or run from command prompt
REM Requires: Node.js

SETLOCAL

set "NODE_EXE=node"

REM Check if node is in PATH
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo Node.js not found in PATH
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

REM Check if we're in the scripts directory
if not exist "%~dp0set-firefox-settings.cjs" (
    echo This script must be run from the scripts directory
    pause
    exit /b 1
)

echo A/V Performance - Firefox Settings Configurator
echo ================================================
echo.

REM Run the Node.js script
%NODE_EXE% "%~dp0set-firefox-settings.cjs" %*

pause
