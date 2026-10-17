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

# A "Career Buddy" shortcut on this user's own Desktop (follows OneDrive redirection).
# Created once; if the user deletes it, it stays deleted.
$desktopDone = Join-Path $CoState 'desktop-shortcut.done'
if (-not (Test-Path $desktopDone)) {
  try {
    $lnk = (New-Object -ComObject WScript.Shell).CreateShortcut((Join-Path ([Environment]::GetFolderPath('Desktop')) 'Career Buddy.lnk'))
    $lnk.TargetPath       = Join-Path $env:WINDIR 'System32\wscript.exe'
    $lnk.Arguments        = "`"$(Join-Path $PSScriptRoot 'app.vbs')`""
    $lnk.WorkingDirectory = $CoRoot
    $lnk.IconLocation     = "$(Join-Path $PSScriptRoot 'career-ops.ico'),0"
    $lnk.Description      = 'Career Buddy job search dashboard'
    $lnk.Save()
    New-Item -ItemType File -Force -Path $desktopDone | Out-Null
    Log 'created Desktop shortcut'
  } catch { Log "Desktop shortcut failed: $($_.Exception.Message)" }
}

# The web's AI runs (Evaluate, PDF, cover letter) start the CLI inside the data root and
# tell it to read system files by relative path (modes/oferta.md, templates/...). Mirror
# that system layer into the data root. /XO keeps a copy the user edited (newer), and the
# user-layer files in modes/ are never touched.
function Sync-CoSystemLayer {
  $rc = @('/E', '/XO', '/R:1', '/W:1', '/NFL', '/NDL', '/NJH', '/NJS', '/NP')
  robocopy (Join-Path $CoRoot 'modes') (Join-Path $CoData 'modes') @rc /XF _profile.md _custom.md _brief.md | Out-Null
  robocopy (Join-Path $CoRoot 'templates') (Join-Path $CoData 'templates') @rc | Out-Null
  robocopy (Join-Path $CoRoot 'batch') (Join-Path $CoData 'batch') batch-prompt.md @rc | Out-Null
  # No /E here: with a file filter it would recreate the whole repo's folder tree, empty.
  robocopy $CoRoot $CoData AGENTS.md CLAUDE.md DATA_CONTRACT.md /XO /R:1 /W:1 /NFL /NDL /NJH /NJS /NP | Out-Null
  # Clean up empty repo-shaped folders (and stray AGENTS.md files) an earlier version left behind.
  foreach ($n in 'dashboard','docs','evals','examples','fonts','lib','node_modules','plugins','plugins-registry','providers','scaffolder','scripts','seeds','test-fixtures','tests','utils','web','windows','data-static','.agents','.antigravitycli','.claude','.claude-plugin','.codex-plugin','.github','.grok','.kimi','.opencode','.qwen','.well-known','.git') {
    $p = Join-Path $CoData $n
    if ((Test-Path $p) -and -not (Get-ChildItem $p -Recurse -File -ErrorAction SilentlyContinue | Where-Object { $_.Name -ne 'AGENTS.md' })) {
      Remove-Item $p -Recurse -Force -ErrorAction SilentlyContinue
    }
  }
  Log 'synced system layer (modes, templates) into the data root'
}
Sync-CoSystemLayer

# README step 4: the application tracker. Without this file merge-tracker has nothing to
# merge into and silently drops every evaluation's row.
$tracker = Join-Path $CoData 'data\applications.md'
if (-not (Test-Path $tracker) -and -not (Test-Path (Join-Path $CoData 'applications.md'))) {
  Set-Content -Path $tracker -Encoding UTF8 -Value @(
    '# Applications Tracker', '',
    '| # | Date | Company | Role | Score | Status | PDF | Report | Notes |',
    '|---|------|---------|------|-------|--------|-----|--------|-------|'
  )
  Log 'created data\applications.md'
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
    Sync-CoSystemLayer
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
