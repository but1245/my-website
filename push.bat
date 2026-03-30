@echo off
echo Checking changes...

git status

echo.
git add .
git commit -m "auto update"
git push

echo.
echo ✔ Successfully Updated!
pause