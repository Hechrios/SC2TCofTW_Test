@echo off
cd /d "%~dp0"
echo Starting SC-TW Converter...
start /min "SC-TW Server" cmd /c "python -m http.server 8000 --bind 127.0.0.1"
timeout /t 2 /nobreak >nul
start "" "http://127.0.0.1:8000/index.html?v=5"
exit
