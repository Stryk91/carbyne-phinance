$env:PATH = "C:\Users\Stryker\AppData\Local\nvm\v22.21.0;$env:PATH"
Set-Location "X:\dev\financial-pipeline-rs\tauri-app"
if (Test-Path "node_modules") {
    Remove-Item -Recurse -Force "node_modules"
}
npm install
