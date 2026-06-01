@echo off
setlocal

cd /d "%~dp0..\.."

if not exist logs mkdir logs

PowerShell -NoProfile -ExecutionPolicy Bypass -Command "$existing = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object { ($_.Name -eq 'node.exe' -or $_.Name -eq 'cmd.exe') -and $_.CommandLine -like '*local-print-agent.cjs*' }; if ($existing) { exit 10 }"
if "%errorlevel%"=="10" (
  echo [%date% %time%] print agent already running, startup skipped >> logs\print-agent-startup.log
  exit /b 0
)

echo [%date% %time%] starting print agent >> logs\print-agent-startup.log
npm.cmd run print:agent >> logs\print-agent-startup.log 2>&1
echo [%date% %time%] print agent stopped with exit code %errorlevel% >> logs\print-agent-startup.log
