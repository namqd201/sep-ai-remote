@echo off
title Sep AI Remote - Backend & Windows Bridge
cd /d "%~dp0"

echo ========================================================
echo  🚀 DANG KHOI CHAY SEP AI REMOTE...
echo  Thu muc: %~dp0
echo ========================================================

node scripts/start-all.js
if %errorlevel% neq 0 (
  echo.
  echo [Loi] Khong the khoi chay. Vui long kiem tra Node.js va pnpm build.
  pause
)
