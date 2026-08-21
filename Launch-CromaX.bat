@echo off
title Launch CromaX IDE
cd /d "%~dp0"
echo Starting CromaX Desktop IDE...
cd editor
if not exist ".\src\vs\workbench\contrib\void\browser\react\out" (
    echo Building React UI components...
    call npm run buildreact
)
start "" .\scripts\code.bat --user-data-dir .\.tmp\user-data --extensions-dir .\.tmp\extensions
