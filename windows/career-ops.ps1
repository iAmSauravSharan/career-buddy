# Career Buddy control (acts on the CURRENT Windows user's own server and data):
#   & 'C:\ProgramData\Career Buddy\app\windows\career-ops.ps1' <command>
#   install | uninstall   set up / remove the all-users shortcuts, Startup entry and PATH (asks for admin)
#   start | stop | restart | status | logs | open | app | scan | dashboard
#   update                pull the latest career-buddy from GitHub, then rebuild
#   build                 reinstall deps + rebuild without restarting other users
#   rebuild               reinstall deps + rebuild the web app, restart every signed-in user
param([Parameter(Position = 0)][string]$Command = 'status')
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'common.ps1')

function Stop-Mine {
  # Non-elevated, this can only touch the current user's processes.
  Get-CimInstance Win32_Process | Where-Object {
    ($_.Name -eq 'powershell.exe' -and $_.CommandLine -like '*run-web.ps1*') -or
    ($_.Name -eq 'node.exe' -and $_.CommandLine -like "*$CoRoot\web*")
  } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
}

function Invoke-Elevated([string]$script, [string[]]$extra) {
  $log = Join-Path $env:TEMP 'career-buddy-admin.log'
  Remove-Item $log -ErrorAction SilentlyContinue
  $argList = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', "`"$(Join-Path $PSScriptRoot $script)`"", '-LogFile', "`"$log`"") + $extra
  $p = Start-Process powershell.exe -Verb RunAs -ArgumentList $argList -Wait -PassThru -WindowStyle Hidden
  Get-Content $log -ErrorAction SilentlyContinue | Where-Object { $_ -notmatch '^\*{5,}|^(Windows PowerShell transcript|Start time|End time|Username|RunAs User|Configuration Name|Machine|Host Application|Process ID|PS(Version|Edition|Compatible|Remoting)|BuildVersion|CLRVersion|WSManStackVersion|SerializationVersion|Transcript started)' }
  if ($p.ExitCode -ne 0) { throw "Admin step failed (exit $($p.ExitCode))." }
}

function Invoke-Npm([string]$dir, [string[]]$npmArgs) {
  $ErrorActionPreference = 'Continue'   # npm warns on stderr; trust its exit code
  Push-Location $dir
  try { & (Join-Path $CoNodeDir 'npm.cmd') @npmArgs; if ($LASTEXITCODE) { throw "npm $($npmArgs -join ' ') failed in $dir" } } finally { Pop-Location }
}

function Invoke-Rebuild([switch]$NoRestart) {
  Stop-Mine
  # Deps only when the lockfile changed (another signed-in user's server can lock node_modules).
  foreach ($dir in $CoRoot, (Join-Path $CoRoot 'web')) {
    # The root package ships no lockfile (npm install); web/ has one (npm ci).
    $lock = Get-Item (Join-Path $dir 'package-lock.json') -ErrorAction SilentlyContinue
    $manifest = if ($lock) { $lock } else { Get-Item (Join-Path $dir 'package.json') }
    $stamp = Get-Item (Join-Path $dir 'node_modules\.package-lock.json') -ErrorAction SilentlyContinue
    if (-not $stamp -or $manifest.LastWriteTime -gt $stamp.LastWriteTime) {
      Invoke-Npm $dir @($(if ($lock) { 'ci' } else { 'install' }), '--no-audit', '--no-fund')
    }
  }
  Invoke-Npm (Join-Path $CoRoot 'web') @('run', 'build')
  if (Get-Command go.exe -ErrorAction SilentlyContinue) {
    $ErrorActionPreference = 'Continue'
    Push-Location (Join-Path $CoRoot 'dashboard'); try { go build -o career-dashboard.exe . } finally { Pop-Location }
  }
  $cache = Join-Path $CoRoot 'web\.next\cache'
  New-Item -ItemType Directory -Force -Path $cache | Out-Null
  icacls $cache /grant '*S-1-5-32-545:(OI)(CI)M' /T /C /Q | Out-Null
  Start-CoRunner
  if ($NoRestart) { return 'Built.' }
  # Other signed-in users' servers are still on the old build; stopping them (needs admin)
  # lets their background workers restart them on the new one.
  try { Invoke-Elevated 'restart-all-users.ps1' @(); 'Rebuilt; every signed-in user is restarting onto the new build.' }
  catch { 'Rebuilt. Admin prompt declined: other signed-in users should run this script with "restart".' }
}

switch ($Command) {
  'install'   { Invoke-Elevated 'install-all-users.ps1' @(); Stop-Mine; Start-CoRunner; "Your dashboard: $CoUrl  (data: $CoData)" }
  'uninstall' { Stop-Mine; Invoke-Elevated 'install-all-users.ps1' @('-Uninstall') }
  'start'     { Start-CoRunner; "Starting... $CoUrl" }
  'stop'      { Stop-Mine; 'Stopped (it starts again at your next logon, or when you open the app).' }
  'restart'   { Stop-Mine; Start-Sleep 2; Start-CoRunner; "Restarting... $CoUrl" }
  'status'    {
    "User:      $env:USERNAME"
    "Code:      $CoRoot"
    "Data:      $CoData"
    "Dashboard: $CoUrl  $(if (Test-CoUp) { 'UP' } else { 'DOWN' })"
  }
  'scan'      { Push-Location $CoRoot; try { & $CoNode scan.mjs } finally { Pop-Location } }
  'logs'      { Get-Content $CoLog -Tail 40 }
  'open'      { Start-Process $CoUrl }
  'app'       { Start-Process wscript.exe -ArgumentList "`"$(Join-Path $PSScriptRoot 'app.vbs')`"" }
  'dashboard' { & (Join-Path $CoRoot 'dashboard\career-dashboard.exe') --path $CoData }
  'update'    {
    $ErrorActionPreference = 'Continue'
    git -C $CoRoot pull --ff-only origin main; if ($LASTEXITCODE) { throw 'git pull failed' }
    $ErrorActionPreference = 'Stop'
    Invoke-Rebuild
  }
  'rebuild'   { Invoke-Rebuild }
  'build'     { Invoke-Rebuild -NoRestart }
  default     { 'Usage: career-ops.ps1 <install|uninstall|start|stop|restart|status|scan|logs|open|app|dashboard|update|rebuild>' }
}
