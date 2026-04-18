$ErrorActionPreference = "Stop"

$projectRoot = "C:\Users\Sorravit_L\Desktop\awb-platform"
Set-Location -Path $projectRoot

. "$projectRoot\scripts\windows\print-agent.env.ps1"

$logDir = Join-Path $projectRoot "logs"
if (-not (Test-Path $logDir)) {
    New-Item -ItemType Directory -Path $logDir -Force | Out-Null
}

$logFile = Join-Path $logDir ("print-agent-{0}.log" -f (Get-Date -Format "yyyy-MM-dd"))

Add-Content -Path $logFile -Value ("[{0}] starting agent" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"))

& node --require "$projectRoot\tests\helpers\register-ts.cjs" "$projectRoot\scripts\local-print-agent.cjs" *>> $logFile 2>&1
$exit = $LASTEXITCODE

Add-Content -Path $logFile -Value ("[{0}] agent exited with code {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $exit)
exit $exit
