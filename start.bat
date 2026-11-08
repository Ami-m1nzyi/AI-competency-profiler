@echo off

:: === Auto-detect Python ===
where py >nul 2>&1
if %errorlevel%==0 (
    set PYTHON=py
    echo [OK] Found Python launcher: py
    goto :found
)

where python >nul 2>&1
if %errorlevel%==0 (
    set PYTHON=python
    echo [OK] Found Python: python
    goto :found
)

echo.
echo [ERROR] Python not found!
echo Please download it from https://python.org
echo.
pause
exit /b 1

:found

:: === Virtual environment ===
if not exist "backend\venv" (
    echo Creating virtual environment...
    %PYTHON% -m venv backend\venv
)
call backend\venv\Scripts\activate.bat

cd backend
if exist requirements.txt (
    pip install -r requirements.txt --quiet
) else (
    pip install flask flask-cors openai werkzeug python-dotenv --quiet
)
cd ..

start "Backend" cmd /k "call backend\venv\Scripts\activate.bat && cd backend && python app.py"

timeout /t 3 /nobreak > nul

start http://localhost:5000

exit