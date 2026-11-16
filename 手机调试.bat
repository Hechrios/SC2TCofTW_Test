@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ============================================================
echo  Mobile debugging server (same Wi-Fi)
echo  Open the IPv4 address below in your phone browser:
echo    http://^<your-LAN-IP^>:8000/index.html
echo ============================================================
ipconfig | findstr /i "IPv4"
echo.
start /min "SC-TW Mobile Server" cmd /c "python -m http.server 8000 --bind 0.0.0.0"
timeout /t 2 /nobreak >nul
start "" "http://127.0.0.1:8000/index.html?v=16"
exit
