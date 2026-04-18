# Windows Print Agent — Auto-start

The print agent runs as a Windows Scheduled Task named **`AWB Print Agent`**,
triggered at user logon. It restarts itself if the Node process crashes
(up to 99 times at 1-minute intervals).

## First-time setup

Copy the env example and fill in secrets (this file is **gitignored**):

```powershell
Copy-Item `
  "scripts\windows\print-agent.env.example.ps1" `
  "scripts\windows\print-agent.env.ps1"
notepad "scripts\windows\print-agent.env.ps1"
```

At minimum set `SUPABASE_SERVICE_ROLE_KEY`, `LOCAL_PRINTER_NAME`, and
`SUMATRA_PDF_PATH`.

## Install / update

Run once from an elevated **or** non-elevated PowerShell — the task runs
under the current user, not as admin:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File `
  "C:\Users\Sorravit_L\Desktop\awb-platform\scripts\windows\install-print-agent-task.ps1"
```

Re-run the same script after editing `print-agent-start.ps1` or
`print-agent.env.ps1`; it unregisters the old task and registers fresh.

## Manage the task

```powershell
Get-ScheduledTask -TaskName 'AWB Print Agent' | Get-ScheduledTaskInfo   # status
Start-ScheduledTask -TaskName 'AWB Print Agent'                         # start now
Stop-ScheduledTask  -TaskName 'AWB Print Agent'                         # stop running instance
Unregister-ScheduledTask -TaskName 'AWB Print Agent' -Confirm:$false    # remove
```

## Logs

Rolling daily file at `awb-platform\logs\print-agent-YYYY-MM-DD.log`
contains both agent stdout/stderr and lifecycle markers (`starting
agent` / `agent exited with code N`).
