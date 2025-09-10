#!/bin/bash

# Hackathon Harvester Setup Script

echo "🏆 Hackathon Harvester Setup"
echo "============================="
echo ""

# Check if Python is installed
if ! command -v python &> /dev/null && ! command -v python3 &> /dev/null; then
    echo "❌ Python is not installed. Please install Python 3.8 or higher."
    exit 1
fi

# Use python3 if available, otherwise python
PYTHON_CMD="python3"
if ! command -v python3 &> /dev/null; then
    PYTHON_CMD="python"
fi

echo "✅ Python found: $($PYTHON_CMD --version)"

# Check if pip is installed
if ! command -v pip &> /dev/null && ! command -v pip3 &> /dev/null; then
    echo "❌ pip is not installed. Please install pip."
    exit 1
fi

PIP_CMD="pip3"
if ! command -v pip3 &> /dev/null; then
    PIP_CMD="pip"
fi

echo "✅ pip found: $($PIP_CMD --version)"

# Create virtual environment
echo ""
echo "📦 Creating virtual environment..."
$PYTHON_CMD -m venv venv

# Activate virtual environment
echo "🔧 Activating virtual environment..."
source venv/bin/activate

# Install dependencies
echo "📥 Installing dependencies..."
$PIP_CMD install -r requirements.txt

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo ""
    echo "⚠️  .env file not found. Creating template..."
    cat > .env << EOL
# Google Gemini API Key (Required)
# Get your API key from: https://makersuite.google.com/app/apikey
GEMINI_API_KEY=your_gemini_api_key_here

# MongoDB Configuration (Required)
# You can use MongoDB Atlas (free tier) or local MongoDB
MONGODB_URI=mongodb://localhost:27017/
MONGODB_DB=hackathon_db

# Flask Configuration (Optional)
FLASK_ENV=development
FLASK_DEBUG=True
EOL
    echo "📝 Created .env template. Please update it with your actual API keys."
else
    echo "✅ .env file found"
fi

echo ""
echo "🎉 Setup complete!"
echo ""
echo "📋 Next steps:"
echo "1. Update the .env file with your Gemini API key"
echo "2. Set up MongoDB (local or Atlas)"
echo "3. Run the application:"
echo "   source venv/bin/activate"
echo "   python app.py"
echo ""
echo "🌐 The application will be available at: http://localhost:5000"
echo ""
echo "📚 Documentation:"
echo "- Gemini API: https://makersuite.google.com/"
echo "- MongoDB Atlas: https://www.mongodb.com/atlas"
echo ""
