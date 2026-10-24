# Machine-wide install of Career Buddy for every account on this PC. Must run as administrator.
#   -Uninstall removes the shortcuts, Startup entry and PATH entries (per-user data folders are left alone).
param([switch]$Uninstall, [string]$LogFile)
$ErrorActionPreference = 'Stop'
if ($LogFile) { Start-Transcript -Path $LogFile -Force | Out-Null }
try {
  $root    = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
  $home_   = Split-Path $root -Parent
  $wscript = Join-Path $env:WINDIR 'System32\wscript.exe'
  $icon    = Join-Path $PSScriptRoot 'career-ops.ico'
  $startup  = [Environment]::GetFolderPath('CommonStartup')
  $programs = [Environment]::GetFolderPath('CommonPrograms')
  $desktop  = [Environment]::GetFolderPath('CommonDesktopDirectory')
  $menu     = Join-Path $programs 'Career Buddy'
  $dash     = Join-Path $root 'dashboard\career-dashboard.exe'
  # Desktop shortcuts are per user (run-web.ps1 makes one on each user's own Desktop at logon).
  # path -> @(target, arguments, description)
  $links = [ordered]@{
    (Join-Path $menu    'Career Buddy.lnk')                  = @($wscript, "`"$(Join-Path $PSScriptRoot 'app.vbs')`"", 'Career Buddy job search dashboard')
    (Join-Path $menu    'Career Buddy terminal dashboard.lnk') = @($dash, '', 'Browse your pipeline in the terminal')
    (Join-Path $startup 'Career Buddy background.lnk')       = @($wscript, "`"$(Join-Path $PSScriptRoot 'run-web.vbs')`"", 'Keeps your Career Buddy dashboard and scheduled scans running')
  }
  $pathDirs = @((Join-Path $home_ 'bin'), (Join-Path $home_ 'node'))

  # Earlier installs: per-user scheduled tasks, "career-ops" shortcuts, runners from the old location.
  foreach ($t in 'career-ops web', 'career-ops recurring scan') {
    Unregister-ScheduledTask -TaskName $t -Confirm:$false -ErrorAction SilentlyContinue
  }
  Get-ChildItem (Join-Path $desktop 'career-ops.lnk'), (Join-Path $desktop 'Career Buddy.lnk'), (Join-Path $programs 'career-ops.lnk'), (Join-Path $startup 'career-ops background.lnk'),
    'C:\Users\*\Desktop\career-ops.lnk', 'C:\Users\*\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\career-ops.lnk' -ErrorAction SilentlyContinue | Remove-Item -Force
  foreach ($p in Get-CimInstance Win32_Process -Filter "Name='powershell.exe' OR Name='node.exe'") {
    $cl = "$($p.CommandLine)"
    if (($cl -like '*run-web.ps1*' -or $cl -like '*\web\node_modules\next*' -or $cl -like '*server.mjs start*' -or $cl -like '*scheduled-jobs-runner.mjs*') -and $cl -notlike "*$root*") {
      Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue
      "Stopped old-location process $($p.ProcessId)"
    }
  }

  $machinePath = [Environment]::GetEnvironmentVariable('Path', 'Machine')
  if ($Uninstall) {
    $links.Keys | ForEach-Object { Remove-Item $_ -Force -ErrorAction SilentlyContinue }
    Remove-Item $menu -Recurse -Force -ErrorAction SilentlyContinue
    $kept = ($machinePath -split ';') | Where-Object { $_ -and ($pathDirs -notcontains $_.TrimEnd('\')) }
    [Environment]::SetEnvironmentVariable('Path', ($kept -join ';'), 'Machine')
    'Removed all-users shortcuts, Startup entry and PATH entries.'
    return
  }

  # Every account reads and runs the shared install; only Next.js' runtime cache is writable.
  icacls $home_ /grant '*S-1-5-32-545:(OI)(CI)RX' /T /C /Q | Out-Null
  $cache = Join-Path $root 'frontend\.next\cache'
  New-Item -ItemType Directory -Force -Path $cache | Out-Null
  icacls $cache /grant '*S-1-5-32-545:(OI)(CI)M' /T /C /Q | Out-Null
  "Granted all users access to $home_."

  # Shared claude.exe and Node for every account, appended so a user's own install still wins.
  $parts = [System.Collections.Generic.List[string]]($machinePath -split ';' | Where-Object { $_ })
  foreach ($d in $pathDirs) { if (-not ($parts | Where-Object { $_.TrimEnd('\') -eq $d })) { $parts.Add($d) } }
  [Environment]::SetEnvironmentVariable('Path', ($parts -join ';'), 'Machine')
  "Machine PATH includes $($pathDirs -join ', ')."

  # PDF generation uses Playwright's browser from a shared folder.
  $shared = Join-Path $env:ProgramData 'ms-playwright'
  $mine = Get-ChildItem 'C:\Users\*\AppData\Local\ms-playwright' -Directory -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($mine -and -not (Test-Path (Join-Path $shared 'chromium*'))) {
    robocopy $mine.FullName $shared /E /NFL /NDL /NJH /NJS /NP | Out-Null
  }
  icacls $shared /grant '*S-1-5-32-545:(OI)(CI)RX' /T /C /Q | Out-Null
  [Environment]::SetEnvironmentVariable('PLAYWRIGHT_BROWSERS_PATH', $shared, 'Machine')
  "Shared PDF browser at $shared."

  New-Item -ItemType Directory -Force -Path $menu | Out-Null
  $shell = New-Object -ComObject WScript.Shell
  foreach ($path in $links.Keys) {
    $target, $arguments, $description = $links[$path]
    if (-not (Test-Path $target)) { "Skipped $path (missing $target)"; continue }
    $lnk = $shell.CreateShortcut($path)
    $lnk.TargetPath       = $target
    $lnk.Arguments        = $arguments
    $lnk.WorkingDirectory = $root
    $lnk.IconLocation     = "$icon,0"
    $lnk.Description      = $description
    $lnk.Save()
    "Created $path"
  }
  'All-users install complete.'
} catch {
  "ERROR: $($_.Exception.Message)"
  exit 1
} finally {
  if ($LogFile) { Stop-Transcript | Out-Null }
}
