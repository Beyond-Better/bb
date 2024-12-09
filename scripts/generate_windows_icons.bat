@echo off
setlocal

rem Change to project root directory
cd /d "%~dp0\.."

rem Check if ImageMagick is installed
where magick >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo Error: ImageMagick is not installed
    echo Please install ImageMagick first: https://imagemagick.org/script/download.php#windows
    exit /b 1
)

rem First generate the PNG files
echo Generating PNG icons...
deno run --allow-read --allow-write scripts/generate_dui_icons.ts

if %ERRORLEVEL% neq 0 (
    echo Error: PNG icon generation failed
    exit /b 1
)

set ICON_DIR=dui\src-tauri\icons

rem Generate ICO file using ImageMagick
echo Generating ICO file...
magick convert ^
    "%ICON_DIR%\win-16x16.png" ^
    "%ICON_DIR%\win-32x32.png" ^
    "%ICON_DIR%\win-48x48.png" ^
    "%ICON_DIR%\win-256x256.png" ^
    "%ICON_DIR%\icon.ico"

if %ERRORLEVEL% equ 0 (
    echo ICO file generated successfully at %ICON_DIR%\icon.ico
    
    rem Clean up temporary win-*.png files
    del "%ICON_DIR%\win-*.png"
    echo Cleaned up temporary files
) else (
    echo Error: ICO generation failed
    exit /b 1
)

echo Icon generation complete!

endlocal