@echo off
title Test print agent cloud link
cd /d "%~dp0"

if not exist ".env" (
  echo Missing .env
  pause
  exit /b 1
)

for /f "usebackq tokens=1,* delims==" %%A in (`.env`) do (
  if /I "%%A"=="CLOUD_URL" set CLOUD_URL=%%B
  if /I "%%A"=="TOKEN" set TOKEN=%%B
)

if "%CLOUD_URL%"=="" set CLOUD_URL=https://tumblejungle689.vercel.app
if "%TOKEN%"=="" set TOKEN=tumble-print

echo Testing %CLOUD_URL%/api/print/heartbeat
echo Token: %TOKEN%
echo.

curl.exe -s -H "X-Print-Token: %TOKEN%" "%CLOUD_URL%/api/print/heartbeat"
echo.
echo.
echo If you see "ok":true — cloud link works. Then run Start Print Agent.bat
echo If "Bad print token" — match TOKEN with Admin -^> Receipt / Print
echo.
pause
