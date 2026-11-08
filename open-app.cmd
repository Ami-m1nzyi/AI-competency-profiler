@echo off
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0open-app.ps1"
if errorlevel 1 pause
