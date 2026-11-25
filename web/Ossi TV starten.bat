@echo off
rem Ossi TV - opens OssiTV-Web.html in a separate Chrome/Edge window
rem that is allowed to talk to the IPTV server (no CORS block).
rem Use this window ONLY for Ossi TV - not for normal browsing.
setlocal
set "F=%~dp0OssiTV-Web.html"
if not exist "%F%" (
  echo OssiTV-Web.html not found next to this file.
  pause
  exit /b 1
)
set "C=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not exist "%C%" set "C=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if not exist "%C%" set "C=%LocalAppData%\Google\Chrome\Application\chrome.exe"
if not exist "%C%" set "C=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
if not exist "%C%" set "C=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
if not exist "%C%" (
  echo Chrome or Edge not found. Please install Google Chrome.
  pause
  exit /b 1
)
set "U=%F:\=/%"
start "" "%C%" --user-data-dir="%LocalAppData%\OssiTV-Chrome" --disable-web-security --autoplay-policy=no-user-gesture-required --no-first-run --app="file:///%U%"
