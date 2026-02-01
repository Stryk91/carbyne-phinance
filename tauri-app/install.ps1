# Install dependencies for Trading App
# Fix PATH for WSL->PowerShell bridge
$env:PATH = "C:\Program Files\nodejs;C:\Users\Stryker_LOCAL\.cargo\bin;$env:PATH"
Set-Location "X:\dev\carbyne-phinance\fp-tauri-dev\tauri-app"
if (Test-Path "node_modules") {
    Remove-Item -Recurse -Force "node_modules"
}
npm install
