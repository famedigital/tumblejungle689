@echo off
title Tumble Jungle Print Agent
cd /d "%~dp0"

where node >nul 2>&1
if errorlevel 1 (
  echo Node.js is not installed.
  echo Install LTS from https://nodejs.org then try again.
  echo.
  pause
  exit /b 1
)

if not exist ".env" (
  if exist ".env.example" copy /y ".env.example" ".env" >nul
  echo Created .env — edit CLOUD_URL, TOKEN, and printer settings, then run this again.
  notepad ".env"
  pause
  exit /b 0
)

echo Starting print agent...
echo Leave this window open while the venue is open.
echo Look for: Connected to cloud
echo.
node server.mjs
echo.
echo Agent stopped.
pause
