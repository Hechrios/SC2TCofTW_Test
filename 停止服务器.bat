@echo off
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8000.*LISTENING"') do (
    taskkill /pid %%a /f >nul 2>&1
)
echo Server stopped.
timeout /t 2 /nobreak >nul
exit
