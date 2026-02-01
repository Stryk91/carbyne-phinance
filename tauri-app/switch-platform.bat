@echo off
REM Switch node_modules between Linux and Windows platforms
REM Usage: switch-platform.bat [linux|win]

set PLATFORM=%1
if "%PLATFORM%"=="" set PLATFORM=win

cd /d %~dp0

if "%PLATFORM%"=="win" (
    if exist node_modules rmdir node_modules 2>nul
    if exist node_modules rd /s /q node_modules 2>nul
    mklink /J node_modules node_modules_win
    echo Switched to Windows node_modules
) else if "%PLATFORM%"=="linux" (
    if exist node_modules rmdir node_modules 2>nul
    if exist node_modules rd /s /q node_modules 2>nul
    mklink /J node_modules node_modules_linux
    echo Switched to Linux node_modules
) else (
    echo Usage: %0 [linux^|win]
)
