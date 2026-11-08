@echo off

echo Cleaning project before sharing...

if exist frontend\node_modules (
    echo Removing node_modules...
    rmdir /s /q frontend\node_modules
)

if exist backend\__pycache__ (
    echo Removing __pycache__...
    rmdir /s /q backend\__pycache__
)

if exist .venv (
    echo Removing .venv...
    rmdir /s /q .venv
)

for /d /r backend %%d in (__pycache__) do (
    if exist "%%d" rmdir /s /q "%%d"
)


REM if exist backend\profiler.db (
    REM echo Removing profiler.db...
    REM del /q backend\profiler.db
REM )

echo.
echo Done. Project is clean.
exit
