# One-time creation of the machine-wide install, run from a dev checkout (no admin needed):
#   powershell -ExecutionPolicy Bypass -File windows\bootstrap.ps1
# Builds C:\ProgramData\Career Buddy\{app,node,bin}, then runs `career-ops.ps1 install` (one admin prompt).
# Re-running refreshes the Node and claude copies; the app itself updates with `career-ops.ps1 update`.
param([string]$Repo = 'https://github.com/iAmSauravSharan/career-buddy.git')
$ErrorActionPreference = 'Stop'
$home_ = Join-Path $env:ProgramData 'Career Buddy'
$app   = Join-Path $home_ 'app'
$node  = Join-Path $home_ 'node'
$bin   = Join-Path $home_ 'bin'

New-Item -ItemType Directory -Force -Path $home_, $bin | Out-Null
# ProgramData lets any user create files under a new folder; make it read-only for everyone but this admin.
icacls $home_ /inheritance:r /grant:r '*S-1-5-18:(OI)(CI)F' '*S-1-5-32-544:(OI)(CI)F' "${env:USERNAME}:(OI)(CI)F" '*S-1-5-32-545:(OI)(CI)RX' /Q | Out-Null

# Private Node runtime, independent of anyone's nvm.
$srcNode = Split-Path (Get-Command node.exe).Source -Parent
robocopy $srcNode $node /MIR /NFL /NDL /NJH /NJS /NP | Out-Null
if ($LASTEXITCODE -ge 8) { throw "copying Node from $srcNode failed" }
"Node $(& (Join-Path $node 'node.exe') -v) -> $node"

# Shared Claude Code binary for accounts that have not installed their own.
$claude = (Get-Command claude.exe).Source
Copy-Item $claude (Join-Path $bin 'claude.exe') -Force
"claude $(& (Join-Path $bin 'claude.exe') --version) -> $bin"

if (-not (Test-Path (Join-Path $app '.git'))) {
  git -c core.symlinks=false clone $Repo $app; if ($LASTEXITCODE) { throw 'git clone failed' }
}
# Windows checkouts without symlink rights get the skill links as text files; use real copies.
$skill = Join-Path $app '.agents\skills\career-ops\SKILL.md'
foreach ($link in git -C $app ls-files -s | Where-Object { $_ -match '^120000 ' } | ForEach-Object { ($_ -split "`t", 2)[1] } | Where-Object { $_ -like '*skills/career-ops/SKILL.md' }) {
  Copy-Item $skill (Join-Path $app $link) -Force
  git -C $app update-index --skip-worktree -- $link
}

& (Join-Path $app 'windows\career-ops.ps1') build
& (Join-Path $app 'windows\career-ops.ps1') install
