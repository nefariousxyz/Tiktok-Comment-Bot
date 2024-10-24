@echo off
setlocal

:: Change directory to the project folder
cd /d "%~dp0"

echo ==============================
echo Checking for missing dependencies...
echo Created by Franz Abiva
echo ==============================

:: Check if Node.js is installed
node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo Node.js is not installed. Please install it first.
    pause
    exit /b
)

:: Attempt to install missing dependencies
echo Installing missing dependencies...
npm install child_process@^1.0.2 electron@^24.0.0 fs@0.0.1-security inquirer@^8.0.0 puppeteer@^19.0.0

if %errorlevel% neq 0 (
    echo ==============================
    echo Error installing dependencies.
    echo Please check the npm logs for more details.
    echo ==============================
    pause
    exit /b
)

:: Check if all dependencies are up to date
echo ==============================
echo Checking for outdated dependencies...
echo ==============================
npm outdated

echo ==============================
echo All dependencies installed successfully.
echo ==============================

:: Prompt the user to update outdated packages
set /p updateDeps="Do you want to update outdated packages? (y/n): "

if /i "%updateDeps%"=="y" (
    echo Updating all packages to their latest versions...
    npm update
    echo ==============================
    echo Packages updated successfully.
    echo ==============================
) else (
    echo Skipping package updates.
)

echo ==============================
echo Installation and update process complete!
echo ==============================
pause
