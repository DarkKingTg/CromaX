@echo off
title CromaX IDE
echo ========================================================
echo               Launching CromaX IDE
echo ========================================================
echo.

:: Ensure scripts directory exists
if not exist "scripts\code.bat" (
    echo [ERROR] Could not find scripts\code.bat.
    echo Please make sure you are running this from the CromaX root directory.
    pause
    exit /b 1
)

:: Launch the CromaX code editor shell
call .\scripts\code.bat %*
pause
