# Per-user background worker: keeps this user's dashboard server alive and runs their
# saved scheduled scans every 15 minutes. Started at logon for every user (all-users Startup).
$ErrorActionPreference = 'Continue'
. (Join-Path $PSScriptRoot 'common.ps1')

$mutex = New-Object System.Threading.Mutex($false, $CoMutexName)
if (-not $mutex.WaitOne(0)) { exit 0 }   # already running for this user

New-Item -ItemType Directory -Force -Path $CoState, (Join-Path $CoData 'data') | Out-Null
# Persist the data root so `claude` / `node` in the repo use this user's files too.
if ([Environment]::GetEnvironmentVariable('CAREER_OPS_ROOT', 'User') -ne $CoData) {
  [Environment]::SetEnvironmentVariable('CAREER_OPS_ROOT', $CoData, 'User')
}

function Log($m) { Add-Content -Path $CoLog -Value "[$(Get-Date -Format s)] $m" }

# First run for this account: the README's setup steps that are per user.
$firstRun = Join-Path $CoState 'setup-v1.done'
if (-not (Test-Path $firstRun)) {
  Push-Location $CoRoot
  try {
    # Starter personalization files (modes/_profile.md, _custom.md, _brief.md, voice-dna.md) in the data root.
    & $CoNode doctor.mjs --json --init-templates *>> $CoLog
    # README step 3: the pre-configured company list for the scanner.
    $portals = Join-Path $CoData 'portals.yml'
    if (-not (Test-Path $portals)) { Copy-Item (Join-Path $CoRoot 'templates\portals.example.yml') $portals }
    # Playwright MCP lets the user's own Claude Code session verify postings and fill forms.
    $claude = Get-Command claude.exe -ErrorAction SilentlyContinue
    if ($claude) {
      & $claude.Source mcp add --scope user playwright -- (Join-Path $CoNodeDir 'npx.cmd') '@playwright/mcp@latest' *>> $CoLog
    }
    Log 'first-run setup done'
    New-Item -ItemType File -Force -Path $firstRun | Out-Null
  } catch { Log "first-run setup failed: $($_.Exception.Message)" } finally { Pop-Location }
}

$web    = Join-Path $CoRoot 'web'
$jobs   = Join-Path $web 'scripts\scheduled-jobs-runner.mjs'
$server = $null; $scan = $null; $nextScan = (Get-Date).AddMinutes(1)
$buildIdFile = Join-Path $web '.next\BUILD_ID'
function Get-BuildId { (Get-Content $buildIdFile -Raw -ErrorAction SilentlyContinue) }
$buildId = Get-BuildId

while ($true) {
  # A rebuild replaces .next under the running server; restart onto the new build.
  $current = Get-BuildId
  if ($current -and $current -ne $buildId -and $server -and -not $server.HasExited) {
    Log 'dashboard was rebuilt; restarting web server'
    taskkill /PID $server.Id /T /F | Out-Null
    $server.WaitForExit(10000) | Out-Null
  }
  if ($current) { $buildId = $current }
  if (-not $server -or $server.HasExited) {
    if ($server) { Log "web server exited ($($server.ExitCode)); restarting" }
    Log "starting web server on port $CoPort (data: $CoData)"
    $server = Start-Process cmd.exe -ArgumentList '/c', "`"`"$CoNode`" server.mjs start -p $CoPort >> `"$CoLog`" 2>&1`"" -WorkingDirectory $web -WindowStyle Hidden -PassThru
  }
  if ((Get-Date) -ge $nextScan -and (-not $scan -or $scan.HasExited)) {
    $scan = Start-Process cmd.exe -ArgumentList '/c', "`"`"$CoNode`" `"$jobs`" >> `"$CoLog`" 2>&1`"" -WorkingDirectory $CoRoot -WindowStyle Hidden -PassThru
    $nextScan = (Get-Date).AddMinutes(15)
  }
  Start-Sleep -Seconds 10
}
