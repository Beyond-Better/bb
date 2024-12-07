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

rem Create the icons directory if it doesn't exist
if not exist "dui\src-tauri\icons" mkdir "dui\src-tauri\icons"

rem Run the icon generation script
echo Generating icons...
deno run --allow-read --allow-write scripts/generate_dui_icons.ts

if %ERRORLEVEL% equ 0 (
    echo Icons generated successfully!
    echo You can find the icons in dui\src-tauri\icons\
) else (
    echo Error: Icon generation failed
    exit /b 1
)

endlocal