@echo off
setlocal enabledelayedexpansion

set "SCRIPT_DIR=%~dp0"
set "BB_EXE=%SCRIPT_DIR%bb.exe"
set "PROJECTS_FILE=%APPDATA%\BB\bb-projects.txt"
set "LAST_PROJECT_FILE=%APPDATA%\BB\last-project.txt"

if not exist "%APPDATA%\BB" mkdir "%APPDATA%\BB"
if not exist "%PROJECTS_FILE%" type nul > "%PROJECTS_FILE%"
if not exist "%LAST_PROJECT_FILE%" type nul > "%LAST_PROJECT_FILE%"

:menu
cls
echo BB Project Manager
echo =================
echo 1. List projects
echo 2. Add project
echo 3. Remove project
echo 4. Run BB command
echo 5. Exit
echo.

set /p choice="Enter your choice: "

if "%choice%"=="1" goto list_projects
if "%choice%"=="2" goto add_project
if "%choice%"=="3" goto remove_project
if "%choice%"=="4" goto run_command
if "%choice%"=="5" exit /b

echo Invalid choice. Please try again.
timeout /t 2 >nul
goto menu

:list_projects
cls
echo Current BB Projects:
echo ====================
type "%PROJECTS_FILE%"
echo.
pause
goto menu

:add_project
set /p new_project="Enter the full path of the new project directory: "
if exist "%new_project%" (
    echo %new_project%>> "%PROJECTS_FILE%"
    echo Project added successfully.
) else (
    echo Directory does not exist. Please enter a valid path.
)
pause
goto menu

:remove_project
set /p remove_project="Enter the number of the project to remove: "
set line_num=1
for /f "tokens=*" %%a in (%PROJECTS_FILE%) do (
    if !line_num! equ %remove_project% (
        set "project_to_remove=%%a"
        goto do_remove
    )
    set /a line_num+=1
)
:do_remove
if defined project_to_remove (
    type "%PROJECTS_FILE%" | findstr /v /c:"%project_to_remove%" > "%PROJECTS_FILE%.tmp"
    move /y "%PROJECTS_FILE%.tmp" "%PROJECTS_FILE%" >nul
    echo Project removed successfully.
) else (
    echo Invalid project number.
)
pause
goto menu

:run_command
set "project_count=0"
for /f %%a in (%PROJECTS_FILE%) do set /a project_count+=1

if %project_count% equ 0 (
    echo No projects configured. Please add a project first.
    pause
    goto menu
)

if %project_count% equ 1 (
    for /f "tokens=*" %%a in (%PROJECTS_FILE%) do set "selected_project=%%a"
) else (
    set /p "last_project=" < "%LAST_PROJECT_FILE%"
    
    echo Select a project:
    set line_num=1
    for /f "tokens=*" %%a in (%PROJECTS_FILE%) do (
        echo !line_num!. %%a
        set /a line_num+=1
    )
    echo.
    set /p project_choice="Enter project number (or press Enter for last used project): "
    
    if not defined project_choice set "project_choice=!last_project!"
    
    set line_num=1
    for /f "tokens=*" %%a in (%PROJECTS_FILE%) do (
        if !line_num! equ !project_choice! (
            set "selected_project=%%a"
            echo !selected_project! > "%LAST_PROJECT_FILE%"
            goto project_selected
        )
        set /a line_num+=1
    )
    
    echo Invalid project number.
    pause
    goto menu
)

:project_selected
set /p command="Enter BB command (init/start/stop): "

if "%command%"=="init" (
    start cmd /k "cd /d "%selected_project%" && "%BB_EXE%" init && pause"
) else if "%command%"=="start" (
    start "" "%BB_EXE%" start
) else if "%command%"=="stop" (
    "%BB_EXE%" stop
) else (
    echo Invalid command. Please use init, start, or stop.
    pause
    goto menu
)

echo Command executed for project: %selected_project%
pause
goto menu