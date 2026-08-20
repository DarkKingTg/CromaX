@echo off
title Launch CromaX IDE
cd /d "%~dp0"
echo Starting CromaX Desktop IDE...
cd editor
start "" .\scripts\code.bat --user-data-dir .\.tmp\user-data --extensions-dir .\.tmp\extensions
