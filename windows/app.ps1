# Opens Career Buddy as a standalone desktop window (Edge app mode) for the current user.
# Starts this user's background server first if it isn't answering yet.
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'common.ps1')

if (-not (Test-CoUp)) {
  Start-CoRunner
  $deadline = (Get-Date).AddSeconds(90)
  while (-not (Test-CoUp) -and (Get-Date) -lt $deadline) { Start-Sleep -Milliseconds 750 }
  if (-not (Test-CoUp)) {
    Add-Type -AssemblyName PresentationFramework
    [System.Windows.MessageBox]::Show("The Career Buddy server didn't start within 90 seconds.`n`nLog: $CoLog", 'Career Buddy', 'OK', 'Error') | Out-Null
    exit 1
  }
}

$browser = @(
  "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
  "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $browser) { Start-Process $CoUrl; exit 0 }

# A dedicated profile gives the app its own taskbar icon and remembers window size.
$profileDir = Join-Path $CoState 'app-profile'
Start-Process $browser -ArgumentList "--app=$CoUrl", "--user-data-dir=`"$profileDir`"", '--no-first-run', '--no-default-browser-check', '--window-size=1400,900'
