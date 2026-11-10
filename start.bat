@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo Drive or Drift: запускаю локальный сервер на http://localhost:8080
start "" http://localhost:8080
where python >nul 2>nul && (python -m http.server 8080 & goto :eof)
where npx >nul 2>nul && (npx --yes http-server -p 8080 -c-1 & goto :eof)
echo Не найден Python или Node.js. Установи один из них или открой index.html напрямую.
pause
