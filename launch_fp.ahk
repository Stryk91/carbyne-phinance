#Requires AutoHotkey v2.0
#SingleInstance Force

; Financial Pipeline Launcher
; Launches the Tauri app (dev or release mode)

global APP_NAME := "Financial Pipeline"
global EXE_NAME := "financial-pipeline-gui"
global PROJECT_DIR := A_ScriptDir "\tauri-app"
global EXE_RELEASE := PROJECT_DIR "\src-tauri\target\release\" EXE_NAME ".exe"
global EXE_DEBUG := PROJECT_DIR "\src-tauri\target\debug\" EXE_NAME ".exe"

; Hotkey: Win+Shift+F to launch
#+f::{
    KeyWait "Shift"  ; Wait for Shift to be released
    KeyWait "LWin"   ; Wait for Win to be released
    LaunchApp()
}

LaunchApp(mode := "auto") {
    ; Check if already running
    if WinExist("ahk_exe " EXE_NAME ".exe") {
        WinActivate
        return
    }

    exePath := ""

    if (mode = "release" || mode = "auto") {
        if FileExist(EXE_RELEASE) {
            exePath := EXE_RELEASE
        }
    }

    if (exePath = "" && (mode = "debug" || mode = "auto")) {
        if FileExist(EXE_DEBUG) {
            exePath := EXE_DEBUG
        }
    }

    if (exePath = "") {
        ; No exe found - offer to build or run dev
        result := MsgBox(
            "No built executable found.`n`n"
            "Would you like to:`n"
            "YES - Run in dev mode (npm run tauri dev)`n"
            "NO - Build release (cargo tauri build)`n"
            "CANCEL - Exit",
            APP_NAME " Launcher",
            "YNC Icon?"
        )

        if (result = "Yes") {
            RunDev()
        } else if (result = "No") {
            BuildRelease()
        }
        return
    }

    ; Launch the app
    try {
        Run exePath, PROJECT_DIR
        TrayTip APP_NAME, "Launched successfully", 1
    } catch as e {
        MsgBox "Failed to launch: " e.Message, APP_NAME " Error", "Icon!"
    }
}

RunDev() {
    ; Open terminal and run dev mode
    try {
        Run 'wt.exe -d "' PROJECT_DIR '" cmd /k "npm run tauri dev"'
        TrayTip APP_NAME, "Starting dev server...", 1
    } catch {
        ; Fallback to cmd
        Run 'cmd.exe /k "cd /d ' PROJECT_DIR ' && npm run tauri dev"'
    }
}

BuildRelease() {
    result := MsgBox(
        "This will build a release version.`n`nProceed?",
        APP_NAME " - Build",
        "YN Icon?"
    )

    if (result = "Yes") {
        try {
            Run 'wt.exe -d "' PROJECT_DIR '" cmd /k "npm run tauri build"'
            TrayTip APP_NAME, "Building release...", 1
        } catch {
            Run 'cmd.exe /k "cd /d ' PROJECT_DIR ' && npm run tauri build"'
        }
    }
}

; Tray menu
A_TrayMenu.Delete()
A_TrayMenu.Add("Launch " APP_NAME, (*) => LaunchApp())
A_TrayMenu.Add("Run Dev Mode", (*) => RunDev())
A_TrayMenu.Add("Build Release", (*) => BuildRelease())
A_TrayMenu.Add()
A_TrayMenu.Add("Open Project Folder", (*) => Run(PROJECT_DIR))
A_TrayMenu.Add()
A_TrayMenu.Add("Exit", (*) => ExitApp())
A_TrayMenu.Default := "Launch " APP_NAME

TrayTip APP_NAME " Launcher", "Win+Shift+F to launch`nRight-click tray for options", 1
