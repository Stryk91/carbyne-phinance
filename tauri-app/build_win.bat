@echo off
set PATH=C:\Program Files\nodejs;C:\Users\Stryker_LOCAL\.cargo\bin;%PATH%
cd /d X:\dev\carbyne-phinance\fp-tauri-dev\tauri-app
npm run tauri build
