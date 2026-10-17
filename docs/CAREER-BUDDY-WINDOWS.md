# career-buddy on a shared Windows PC

`windows/` installs career-buddy once for every account on the machine. Each account gets its own data, its own dashboard port and its own background worker.

## Layout

| Path | What |
|---|---|
| `C:\ProgramData\Career Buddy\app` | this repo, built (read-only for normal users) |
| `C:\ProgramData\Career Buddy\node` | private Node.js runtime, so no one depends on another user's nvm |
| `C:\ProgramData\Career Buddy\bin\claude.exe` | shared Claude Code for accounts without their own install |
| `C:\ProgramData\ms-playwright` | shared Chromium for PDFs |
| `%USERPROFILE%\Documents\career-ops` | each user's CV, profile, tracker, reports, `.env` |
| `%LOCALAPPDATA%\career-ops` | each user's log and app window profile |

Shortcuts for everyone: **Career Buddy** on the public Desktop, a **Career Buddy** Start Menu folder (app + terminal dashboard), and **Career Buddy background** in the all-users Startup folder. The dashboard for an account runs at `http://localhost:{3000 + last part of its SID mod 1000}`.

## Install / update

```powershell
# once, from a dev checkout (one admin prompt)
powershell -ExecutionPolicy Bypass -File windows\bootstrap.ps1

# later
$cb = 'C:\ProgramData\Career Buddy\app\windows\career-ops.ps1'
& $cb update     # git pull from GitHub + rebuild + restart every signed-in user
& $cb status     # this user's port, data folder, UP/DOWN
& $cb uninstall  # remove shortcuts, Startup entry, PATH entries (data stays)
```

## Per user, once

The first time the background worker runs for an account it copies the starter personalization files into that user's data folder and registers the Playwright MCP server in their Claude Code config. Each person still has to:

1. Sign in to Claude Code once: open a terminal, run `claude`, and finish the login. The dashboard's AI features (CV import, evaluations) run as that user.
2. Open **Career Buddy**, upload a CV, and fill in the profile.
