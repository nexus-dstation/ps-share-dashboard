@echo off
setlocal

cd /d "%~dp0"

echo [1/3] 表示用データを再生成します...
"C:\Users\knanbu\AppData\Local\Programs\Python\Python313\python.exe" ".\generate_dashboard_data.py"
if errorlevel 1 (
  echo データ生成に失敗しました。
  exit /b 1
)

echo [2/3] Gitへ追加します...
git add data/dashboard-data.csv data/dashboard-data.json data/dashboard-data.js generate_dashboard_data.py README.md update_dashboard_data.bat

echo [3/3] 状態確認です。
git status --short

echo.
echo 生成完了です。必要なら次を実行してください:
echo   git commit -m "Add monthly dashboard data"
echo   git push

endlocal
