@echo off
setlocal

set "APP_DIR=C:\Users\Sorravit_L\Desktop\Online"
set "LOG_DIR=%APP_DIR%\logs"

if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"

cd /d "%APP_DIR%"

echo [%date% %time%] Starting AWB Seller Center Agent >> "%LOG_DIR%\seller-center-agent.log"

findstr /B /C:"SHOPEE_SELLER_CENTER_MODE=extension" ".env.local" >nul 2>nul
if not errorlevel 1 (
  echo [%date% %time%] Starting AWB Seller Center Extension Bridge >> "%LOG_DIR%\seller-center-agent.log"
  npm.cmd run seller-center:extension-bridge >> "%LOG_DIR%\seller-center-agent.log" 2>&1
  echo [%date% %time%] AWB Seller Center Extension Bridge stopped >> "%LOG_DIR%\seller-center-agent.log"
  exit /b %errorlevel%
)

findstr /B /C:"SELLER_CENTER_CDP_AUTO_LAUNCH=true" ".env.local" >nul 2>nul
if not errorlevel 1 (
  call "%APP_DIR%\scripts\windows\start-chrome-seller-center-debug.cmd" >> "%LOG_DIR%\seller-center-agent.log" 2>&1
)

npm.cmd run seller-center:agent >> "%LOG_DIR%\seller-center-agent.log" 2>&1

echo [%date% %time%] AWB Seller Center Agent stopped >> "%LOG_DIR%\seller-center-agent.log"
