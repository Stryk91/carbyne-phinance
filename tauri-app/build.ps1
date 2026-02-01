# Build script for Trading App
# Fix PATH for WSL->PowerShell bridge
$env:PATH = "C:\Program Files\nodejs;C:\Users\Stryker_LOCAL\.cargo\bin;$env:PATH"
Set-Location "X:\dev\carbyne-phinance\fp-tauri-dev\tauri-app"
npm run build
