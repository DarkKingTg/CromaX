@echo off
title CromaX IDE
echo ========================================================
echo               Launching CromaX IDE
echo ========================================================
echo.

set VSCODE_DEV=1
set NODE_ENV=development
set VSCODE_CLI=1

:: Bypass prelaunch build check if electron binary exists for 0s instant launch
if exist ".build\electron\CromaX.exe" (
    set VSCODE_SKIP_PRELAUNCH=1
)

:: Launch the CromaX code editor shell
call .\scripts\code.bat %*

