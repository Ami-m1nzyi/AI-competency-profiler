@echo off

cd frontend
call npm install --silent
call npm run build
cd ..

if exist backend\static rmdir /s /q backend\static
xcopy /e /i /y frontend\dist backend\static

echo.
echo Frontend rebuilt and copied to backend\static.
exit