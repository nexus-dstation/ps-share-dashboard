@echo off
setlocal

cd /d "%~dp0"

echo [1/3] Generate dashboard data...
powershell -ExecutionPolicy Bypass -Command "& 'C:\Users\knanbu\AppData\Local\Programs\Python\Python313\python.exe' '.\generate_dashboard_data.py'"
if errorlevel 1 (
  echo Failed to generate dashboard data.
  pause
  exit /b 1
)

echo [2/3] Stage updated files...
git add .
if errorlevel 1 (
  echo Failed to stage files.
  pause
  exit /b 1
)

echo [3/3] Current git status:
git status --short

echo.
echo Next commands:
echo   git commit -m "Add YYYY-MM dashboard data"
echo   git push
echo.
pause

endlocal
