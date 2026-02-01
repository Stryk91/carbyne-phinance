@echo off
setlocal

set "APP_NAME=Financial Pipeline"
set "EXE_NAME=financial-pipeline-gui"
set "PROJECT_DIR=%~dp0tauri-app"
set "EXE_RELEASE=%PROJECT_DIR%\src-tauri\target\release\%EXE_NAME%.exe"
set "EXE_DEBUG=%PROJECT_DIR%\src-tauri\target\debug\%EXE_NAME%.exe"

:: Check release build first
if exist "%EXE_RELEASE%" (
    echo Launching %APP_NAME% [release]...
    start "" "%EXE_RELEASE%"
    exit /b 0
)

:: Check debug build
if exist "%EXE_DEBUG%" (
    echo Launching %APP_NAME% [debug]...
    start "" "%EXE_DEBUG%"
    exit /b 0
)

:: No exe found
echo.
echo No built executable found.
echo.
echo Options:
echo   1. Run dev mode (npm run tauri dev)
echo   2. Build release (npm run tauri build)
echo   3. Exit
echo.
choice /c 123 /n /m "Select option: "

if errorlevel 3 exit /b 0
if errorlevel 2 goto build
if errorlevel 1 goto dev

:dev
echo.
echo Starting dev server...
cd /d "%PROJECT_DIR%"
npm run tauri dev
exit /b 0

:build
echo.
echo Building release...
cd /d "%PROJECT_DIR%"
npm run tauri build
if exist "%EXE_RELEASE%" (
    echo.
    echo Build complete! Launching...
    start "" "%EXE_RELEASE%"
)
exit /b 0
