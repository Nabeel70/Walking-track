param(
    [switch]$IncludeMobile
)

$root = Split-Path -Parent $MyInvocation.MyCommand.Path

function Start-App {
    param(
        [string]$Name,
        [string]$WorkingDirectory,
        [string]$Command
    )

    Write-Host "Launching $Name..." -ForegroundColor Cyan
    $escapedCommand = $Command -replace "'", "''"
    Start-Process powershell -ArgumentList @(
        '-NoExit',
        '-ExecutionPolicy', 'Bypass',
        '-Command', "Set-Location '$WorkingDirectory'; $escapedCommand"
    ) | Out-Null
}

Start-App -Name 'WalkTrack API' -WorkingDirectory (Join-Path $root 'server') -Command 'npm run dev'
Start-App -Name 'WalkTrack Dashboard' -WorkingDirectory (Join-Path $root 'web') -Command 'npm run dev'

if ($IncludeMobile) {
    Start-App -Name 'WalkTrack Mobile (Expo)' -WorkingDirectory (Join-Path $root 'mobile') -Command 'npx expo start'
}

Write-Host "Processes launched. Close individual windows to stop them." -ForegroundColor Green
