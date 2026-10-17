# Per-user settings shared by the Career Buddy launcher scripts. Dot-source it.
# Layout of the machine-wide install (see install-all-users.ps1):
#   C:\ProgramData\Career Buddy\app      this repo (the scripts live in app\windows)
#   C:\ProgramData\Career Buddy\node     private Node.js runtime
#   C:\ProgramData\Career Buddy\bin      shared claude.exe
# Every Windows account gets its own data folder, port and logs, so users never see each other's search.
$CoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$CoHome = Split-Path $CoRoot -Parent
$CoNodeDir = Join-Path $CoHome 'node'
$CoBinDir  = Join-Path $CoHome 'bin'
# Fall back to whatever is on PATH when running from a dev checkout.
$CoNode = if (Test-Path (Join-Path $CoNodeDir 'node.exe')) { Join-Path $CoNodeDir 'node.exe' } else { (Get-Command node.exe -ErrorAction Stop).Source }
$CoSid  = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
$rid    = [int]($CoSid.Split('-')[-1])
# Local account IDs start at 1000 (Admin=1001 -> 3001, surum=1020 -> 3020, ...).
$CoPort = 3000 + ($rid % 1000)
$CoUrl  = "http://localhost:$CoPort"
$CoData = Join-Path ([Environment]::GetFolderPath('MyDocuments')) 'career-ops'
$CoState = Join-Path $env:LOCALAPPDATA 'career-ops'
$CoLog  = Join-Path $CoState 'web.log'
$CoMutexName = "Global\career-buddy-runner-$CoSid"
$env:CAREER_OPS_ROOT = $CoData
# Child processes (web server, scans, the AI CLI it spawns) use the shared runtime first.
# The user's own tools stay on PATH after it, so a personal claude/codex login still works.
foreach ($d in $CoBinDir, $CoNodeDir) { if ((Test-Path $d) -and ($env:Path -notlike "*$d*")) { $env:Path = "$d;$env:Path" } }
# Optional API keys: this user's own .env first, then the machine-wide keys.env shared by every account.
# Neither overrides a variable that is already set.
foreach ($f in (Join-Path $CoData '.env'), (Join-Path $CoHome 'keys.env')) {
  if (-not (Test-Path $f)) { continue }
  foreach ($line in Get-Content $f) {
    if ($line -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$' -and -not [Environment]::GetEnvironmentVariable($Matches[1])) {
      [Environment]::SetEnvironmentVariable($Matches[1], $Matches[2].Trim('"', "'"))
    }
  }
}

function Test-CoUp { try { Invoke-WebRequest $CoUrl -UseBasicParsing -TimeoutSec 3 | Out-Null; $true } catch { $false } }
function Start-CoRunner { Start-Process wscript.exe -ArgumentList "`"$(Join-Path $PSScriptRoot 'run-web.vbs')`"" }
