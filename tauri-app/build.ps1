# Build script for Financial Pipeline
# Fix PATH for WSL->PowerShell bridge
$env:PATH = "C:\Program Files\nodejs;C:\Users\Stryker_LOCAL\.cargo\bin;$env:PATH"
Set-Location "X:\dev\financial-pipeline-rs\tauri-app"
npm run build
