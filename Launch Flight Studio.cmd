@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Flight Studio needs an existing Node.js 18 or later installation.
  echo No dependencies or internet are required after Node is available.
  pause
  exit /b 1
)
node "tools\flight-studio\launch.mjs"
if errorlevel 1 pause
