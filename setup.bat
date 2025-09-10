@echo off
title Hackathon Harvester Setup

echo 🏆 Hackathon Harvester Setup
echo =============================
echo.

REM Check if Python is installed
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Python is not installed. Please install Python 3.8 or higher.
    echo Download from: https://www.python.org/downloads/
    pause
    exit /b 1
)

for /f tokens^=2 %%i in ('python --version') do set PYTHON_VERSION=%%i
echo ✅ Python found: %PYTHON_VERSION%

REM Check if pip is installed
pip --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ pip is not installed. Please install pip.
    pause
    exit /b 1
)

echo ✅ pip found

REM Create virtual environment
echo.
echo 📦 Creating virtual environment...
python -m venv venv

REM Activate virtual environment
echo 🔧 Activating virtual environment...
call venv\Scripts\activate.bat

REM Install dependencies
echo 📥 Installing dependencies...
pip install -r requirements.txt

REM Check if .env file exists
if not exist ".env" (
    echo.
    echo ⚠️  .env file not found. Creating template...
    (
        echo # Google Gemini API Key ^(Required^)
        echo # Get your API key from: https://makersuite.google.com/app/apikey
        echo GEMINI_API_KEY=your_gemini_api_key_here
        echo.
        echo # MongoDB Configuration ^(Required^)
        echo # You can use MongoDB Atlas ^(free tier^) or local MongoDB
        echo MONGODB_URI=mongodb://localhost:27017/
        echo MONGODB_DB=hackathon_db
        echo.
        echo # Flask Configuration ^(Optional^)
        echo FLASK_ENV=development
        echo FLASK_DEBUG=True
    ) > .env
    echo 📝 Created .env template. Please update it with your actual API keys.
) else (
    echo ✅ .env file found
)

echo.
echo 🎉 Setup complete!
echo.
echo 📋 Next steps:
echo 1. Update the .env file with your Gemini API key
echo 2. Set up MongoDB ^(local or Atlas^)
echo 3. Run the application:
echo    venv\Scripts\activate
echo    python app.py
echo.
echo 🌐 The application will be available at: http://localhost:5000
echo.
echo 📚 Documentation:
echo - Gemini API: https://makersuite.google.com/
echo - MongoDB Atlas: https://www.mongodb.com/atlas
echo.
pause
