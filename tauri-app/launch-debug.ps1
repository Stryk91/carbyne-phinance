# Launch Financial Pipeline with CDP debugging enabled
$env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS = "--remote-debugging-port=9222"
Start-Process "X:\dev\financial-pipeline-rs\tauri-app\src-tauri\target\debug\financial-pipeline-gui.exe"
Write-Host "App launched with CDP on ws://localhost:9222"
Write-Host "Connect with: chrome://inspect or any CDP client"
