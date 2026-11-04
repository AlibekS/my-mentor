@echo off
rem L3 Quest: zapusk dvojnym shchelchkom (Windows)
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js не найден. Установите Node.js LTS: https://nodejs.org  или  winget install OpenJS.NodeJS.LTS
  pause
  exit /b 1
)
if not exist node_modules (
  echo Первый запуск: устанавливаю зависимости, это займёт 1-2 минуты...
  call npm install
  if errorlevel 1 (
    pause
    exit /b 1
  )
)
echo.
echo L3 Quest: http://127.0.0.1:5173  (окно не закрывай; остановить - Ctrl+C)
call npm run dev -- --open
pause
