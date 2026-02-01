# Dev Log Append Helper
# Usage: . .\devlog-append.ps1; Add-DevLogEntry -Title "My Change" -Author "KALIC" -Files "file1.rs,file2.ts" -Summary "What I did"
# Usage: Add-DevLogError -Error "npm not found" -When "Running build" -Fix "Added to PATH"

$DevLogPath = "X:\dev\carbyne-phinance\fp-tauri-dev\DEV_LOG.md"

function Add-DevLogEntry {
    param(
        [Parameter(Mandatory)][string]$Title,
        [Parameter(Mandatory)][string]$Author,
        [string]$Files = "",
        [Parameter(Mandatory)][string]$Summary,
        [string[]]$Changes = @()
    )
    
    $date = Get-Date -Format "yyyy-MM-dd"
    $entry = @"

---

## [$date] $Title
**Author:** $Author
**Files:** ``$Files``
**Summary:** $Summary

"@
    foreach ($change in $Changes) {
        $entry += "- $change`n"
    }
    
    # Find "## Pending" line and insert before it
    $content = Get-Content $DevLogPath -Raw
    $insertPoint = $content.IndexOf("## Pending")
    if ($insertPoint -gt 0) {
        $newContent = $content.Insert($insertPoint, "$entry`n")
        $newContent | Out-File $DevLogPath -Encoding UTF8 -NoNewline
    } else {
        Add-Content $DevLogPath $entry
    }
    Write-Host "[DEVLOG] Added entry: $Title" -ForegroundColor Green
}

function Add-DevLogError {
    param(
        [Parameter(Mandatory)][string]$Error,
        [Parameter(Mandatory)][string]$When,
        [Parameter(Mandatory)][string]$Fix,
        [string]$Prevention = ""
    )
    
    $entry = @"

### ❌ ERROR: $Error
**When:** $When
**Fix:** $Fix
"@
    if ($Prevention) {
        $entry += "`n**Prevention:** $Prevention"
    }
    
    $content = Get-Content $DevLogPath -Raw
    $insertPoint = $content.IndexOf("## Pending")
    if ($insertPoint -gt 0) {
        $newContent = $content.Insert($insertPoint, "$entry`n`n")
        $newContent | Out-File $DevLogPath -Encoding UTF8 -NoNewline
    } else {
        Add-Content $DevLogPath $entry
    }
    Write-Host "[DEVLOG] Added error: $Error" -ForegroundColor Yellow
}

function Add-DevLogTodo {
    param([Parameter(Mandatory)][string]$Task)
    
    $content = Get-Content $DevLogPath -Raw
    $todoLine = "- [ ] $Task"
    
    # Find existing TODO section and append
    $pattern = "## Pending / TODO\r?\n"
    if ($content -match $pattern) {
        $content = $content -replace "($pattern)", "`$1$todoLine`n"
        $content | Out-File $DevLogPath -Encoding UTF8 -NoNewline
        Write-Host "[DEVLOG] Added TODO: $Task" -ForegroundColor Cyan
    }
}

Write-Host "[DEVLOG Helper] Loaded. Commands: Add-DevLogEntry, Add-DevLogError, Add-DevLogTodo" -ForegroundColor Green
