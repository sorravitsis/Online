@echo off
setlocal

set "CHROME_EXE=C:\Program Files\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME_EXE%" set "CHROME_EXE=C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"

if not exist "%CHROME_EXE%" (
  echo Google Chrome was not found.
  exit /b 1
)

powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "try { Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:9222/json/version' -TimeoutSec 1 | Out-Null; exit 0 } catch { exit 1 }"
if not errorlevel 1 (
  echo Chrome remote debugging is already available on port 9222.
  exit /b 0
)

powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "if (Get-Process chrome -ErrorAction SilentlyContinue) { exit 1 } else { exit 0 }"
if errorlevel 1 (
  echo Chrome is already running without remote debugging. Not opening another Chrome window.
  exit /b 1
)

set "PROFILE_DIR=%USERPROFILE%\.awb-chrome-cdp-profile"
if not exist "%PROFILE_DIR%" mkdir "%PROFILE_DIR%"

start "" "%CHROME_EXE%" --remote-debugging-port=9222 --remote-allow-origins=http://127.0.0.1:9222 --kiosk-printing --user-data-dir="%PROFILE_DIR%" --new-window "https://seller.shopee.co.th/portal/sale/order"

powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "Start-Sleep -Seconds 5"

powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "try { Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:9222/json/version' -TimeoutSec 1 | Out-Null; exit 0 } catch { exit 1 }"
if errorlevel 1 (
  echo Chrome remote debugging did not become available on port 9222.
  exit /b 1
)

echo Chrome remote debugging is ready on port 9222.
