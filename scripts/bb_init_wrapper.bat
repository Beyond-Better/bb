@echo off
setlocal enabledelayedexpansion

cd /d "%~1"
"%~2" init

echo.
echo BB init completed. Press any key to close this window.
pause >nul