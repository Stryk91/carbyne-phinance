# Build environment wrapper for Financial Pipeline
# Fixes PATH issues when calling from WSL

$env:PATH = "C:\Program Files\nodejs;C:\Users\Stryker_LOCAL\.cargo\bin;$env:PATH"

# If arguments passed, run them
if ($args.Count -gt 0) {
    $cmd = $args[0]
    $cmdArgs = $args[1..($args.Count-1)]
    & $cmd @cmdArgs
} else {
    Write-Host "Build environment loaded. PATH includes nodejs and cargo."
    Write-Host "Usage: .\build-env.ps1 npm run build"
    Write-Host "       .\build-env.ps1 cargo tauri dev"
}
