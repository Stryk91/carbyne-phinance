# Install dependencies for Financial Pipeline
# Fix PATH for WSL->PowerShell bridge
$env:PATH = "C:\Program Files\nodejs;C:\Users\Stryker_LOCAL\.cargo\bin;$env:PATH"
Set-Location "X:\dev\financial-pipeline-rs\tauri-app"
if (Test-Path "node_modules") {
    Remove-Item -Recurse -Force "node_modules"
}
npm install
