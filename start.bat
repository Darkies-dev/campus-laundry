@echo off
title CampusLaundry Launcher
echo ===================================================
echo   Starting CampusLaundry (Backend + Frontend)
echo ===================================================
echo.

:: 1. Launch Backend API (Port 5000)
echo [1/2] Starting Flask Backend...
start "CampusLaundry Backend (Port 5000)" cmd /k "cd /d "%~dp0backend" && call .venv\Scripts\activate.bat && python app.py"

:: 2. Launch Frontend Dev Server (Port 3000)
echo [2/2] Starting Next.js Frontend...
start "CampusLaundry Frontend (Port 3000)" cmd /k "cd /d "%~dp0frontend" && npm run dev"

echo.
echo Servers started in separate windows!
echo   - Backend:  http://localhost:5000
echo   - Frontend: http://localhost:3000
echo.
echo Opening browser in 3 seconds...
timeout /t 3 >nul
start http://localhost:3000
