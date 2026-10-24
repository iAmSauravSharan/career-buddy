# Stops every signed-in user's Career Buddy web server (needs admin). Each user's background
# worker restarts its server within ~10s, onto whatever build is now in frontend\.next.
param([string]$LogFile)
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$out = foreach ($p in Get-CimInstance Win32_Process -Filter "Name='node.exe'") {
  if ($p.CommandLine -and ($p.CommandLine.Contains("$root\frontend\node_modules\next") -or $p.CommandLine.Contains("$root\backend\"))) {
    Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue
    "stopped web server pid $($p.ProcessId)"
  }
}
if ($LogFile) { ($out | Out-String) | Set-Content -Path $LogFile -Encoding UTF8 }
