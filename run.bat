@echo off
setlocal

set ROOT=%~dp0

cd /d "%ROOT%backend"
call npm install

cd /d "%ROOT%frontend"
call npm install

start "Backend" cmd /k "cd /d "%ROOT%backend" && npm run dev"
start "Frontend" cmd /k "cd /d "%ROOT%frontend" && npm run dev"

echo Backend and frontend are starting in separate windows.
