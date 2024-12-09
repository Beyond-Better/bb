@echo off
setlocal

rem Change to project root directory
cd /d "%~dp0\.."

rem Check if deno is installed
where deno >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo Error: deno is not installed
    echo Please install deno first: https://deno.land/#installation
    exit /b 1
)

rem Run the verification script
echo Running development environment verification...
deno run --allow-run --allow-read scripts/verify_dui_setup.ts

rem Check the exit code
if %ERRORLEVEL% equ 0 (
    echo Verification completed successfully!
) else (
    echo Verification failed. Please fix the reported issues.
    exit /b 1
)

endlocal