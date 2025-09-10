# 🏆 Hackathon Harvester

An AI-powered web scraper that finds and organizes hackathon information from various platforms like Unstop, Devfolio, HackerEarth, and more using Google's Gemini AI with integrated search capabilities.

![GitHub Docs Style Interface](https://img.shields.io/badge/UI-GitHub%20Docs%20Style-blue)
![Python](https://img.shields.io/badge/Python-3.8%2B-green)
![Flask](https://img.shields.io/badge/Flask-3.0-red)
![MongoDB](https://img.shields.io/badge/MongoDB-Atlas%20Ready-brightgreen)
![Gemini AI](https://img.shields.io/badge/AI-Google%20Gemini-orange)

## ✨ Features

### 🔍 AI-Powered Search
- **Google Gemini Integration**: Uses Gemini 2.5 Pro with Google Search tools
- **Smart Extraction**: Automatically extracts hackathon details in structured JSON format
- **Multi-Platform Support**: Searches across Unstop, Devfolio, HackerEarth, MLH, and more
- **Custom Queries**: Search for specific types of hackathons (AI/ML, Web3, Mobile, etc.)

### 📊 Data Management
- **MongoDB Storage**: Scalable database storage with MongoDB Atlas support
- **CRUD Operations**: Create, Read, Update, Delete hackathon entries
- **Data Validation**: Automatic data cleaning and validation
- **Export Options**: JSON API endpoints for data integration

### 🎨 GitHub Docs-Style Interface
- **Modern UI**: Clean, professional interface inspired by GitHub Docs
- **Dark/Light Mode**: Automatic theme switching with user preference
- **Responsive Design**: Mobile-friendly layout
- **Accessibility**: WCAG compliant with keyboard navigation

### 🛠️ Advanced Features
- **Real-time Search**: Live hackathon discovery with status updates
- **Smart Categorization**: Automatic tag suggestions based on content
- **Date Detection**: Intelligent deadline and event date extraction
- **URL Validation**: Website link verification
- **Auto-save Drafts**: Prevents data loss during editing

## 🚀 Quick Start

### Prerequisites
- Python 3.8 or higher
- MongoDB (local installation or MongoDB Atlas account)
- Google Gemini API key ([Get one here](https://makersuite.google.com/app/apikey))

### Installation

#### Option 1: Automated Setup (Recommended)

**For Windows:**
```bash
setup.bat
```

**For Linux/Mac:**
```bash
chmod +x setup.sh
./setup.sh
```

#### Option 2: Manual Setup

1. **Clone the repository:**
```bash
git clone https://github.com/your-username/hackathon-harvestor.git
cd hackathon-harvestor
```

2. **Create virtual environment:**
```bash
python -m venv venv
source venv/bin/activate  # Linux/Mac
# or
venv\Scripts\activate     # Windows
```

3. **Install dependencies:**
```bash
pip install -r requirements.txt
```

4. **Set up environment variables:**
```bash
cp .env.example .env
# Edit .env with your API keys
```

5. **Run the application:**
```bash
python app.py
```

### Environment Configuration

Create a `.env` file with the following variables:

```env
# Google Gemini API Key (Required)
GEMINI_API_KEY=your_gemini_api_key_here

# MongoDB Configuration (Required)
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/
MONGODB_DB=hackathon_db

# Flask Configuration (Optional)
FLASK_ENV=development
FLASK_DEBUG=True
```

## 📖 Usage Guide

### 1. Search for Hackathons
- Navigate to the home page
- Enter search terms in the search box (e.g., "AI hackathons 2024", "blockchain competitions")
- Click "Search Hackathons" to start the AI-powered search
- Wait for results to be processed and displayed

### 2. View Hackathon Details
- Click on any hackathon title to view full details
- See comprehensive information including:
  - Description and requirements
  - Important dates and deadlines
  - Prize information
  - Registration links
  - Eligibility criteria

### 3. Edit Hackathon Information
- Click "Edit" on any hackathon card
- Update information using the comprehensive form
- Use smart features like:
  - Auto-date detection
  - Tag suggestions
  - URL validation
  - Preview changes

### 4. Manage Your Database
- Delete outdated hackathons
- Update information as needed
- Export data via API endpoints

## 🏗️ Architecture

### Backend Components
- **Flask Application**: Main web server and routing
- **Gemini AI Integration**: LlamaIndex with Google Gemini 2.5 Pro
- **MongoDB Database**: Document storage with PyMongo
- **Data Processing**: JSON parsing and validation
- **API Endpoints**: RESTful API for data access

### Frontend Components
- **Jinja2 Templates**: Server-side rendering
- **GitHub Primer CSS**: Base styling framework
- **Custom CSS**: Enhanced styling and animations
- **JavaScript**: Interactive features and AJAX calls
- **Font Awesome**: Icon library

### Data Flow
```
User Query → Gemini AI → Google Search → Data Extraction → 
JSON Parsing → MongoDB Storage → Web Interface Display
```

## 🛠️ API Documentation

### Endpoints

#### GET `/`
- **Description**: Home page with hackathon listing
- **Response**: HTML page with hackathon cards

#### POST `/scrape`
- **Description**: Search for new hackathons
- **Body**: `{"query": "search terms"}`
- **Response**: `{"success": true, "count": number}`

#### GET `/api/hackathons`
- **Description**: Get all hackathons as JSON
- **Response**: Array of hackathon objects

#### GET `/hackathon/<id>`
- **Description**: View single hackathon details
- **Response**: HTML page with hackathon details

#### POST `/update/<id>`
- **Description**: Update hackathon information
- **Body**: Form data with hackathon fields
- **Response**: Redirect to hackathon details

#### POST `/delete/<id>`
- **Description**: Delete hackathon
- **Response**: `{"success": true}`

### Data Schema

```json
{
  "_id": "ObjectId",
  "title": "Hackathon Name",
  "description": "Detailed description",
  "organizer": "Organization name",
  "registration_deadline": "YYYY-MM-DD",
  "event_date": "YYYY-MM-DD",
  "prize_pool": "Prize amount",
  "website_url": "https://...",
  "platform": "unstop|devfolio|hackerearth|mlh|other",
  "status": "open|closed|upcoming",
  "tags": ["tag1", "tag2"],
  "eligibility": "Eligibility criteria",
  "scraped_at": "2024-01-01T00:00:00Z",
  "source": "gemini_search"
}
```

## 🔧 Configuration

### MongoDB Setup

#### Local MongoDB
```bash
# Install MongoDB locally
# Update .env
MONGODB_URI=mongodb://localhost:27017/
```

#### MongoDB Atlas (Recommended)
1. Create account at [MongoDB Atlas](https://www.mongodb.com/atlas)
2. Create a new cluster
3. Get connection string
4. Update `.env` with your connection string

### Gemini API Setup
1. Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create a new API key
3. Add to `.env` file

## 🎨 Customization

### Theme Customization
- Edit `static/css/custom.css` for styling changes
- Modify color variables in the CSS root
- Add custom animations and transitions

### Search Customization
- Modify search prompts in `app.py`
- Adjust data extraction patterns
- Add new platforms or data sources

### UI Customization
- Edit Jinja2 templates in `templates/`
- Add new pages or modify existing layouts
- Customize the GitHub Docs styling

## 🧪 Testing

### Manual Testing
1. Start the application
2. Test search functionality with various queries
3. Verify CRUD operations work correctly
4. Check responsive design on different devices

### API Testing
```bash
# Test API endpoints
curl -X GET http://localhost:5000/api/hackathons
curl -X POST http://localhost:5000/scrape -H "Content-Type: application/json" -d '{"query": "AI hackathons"}'
```

## 📝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines
- Follow PEP 8 for Python code
- Use meaningful commit messages
- Add comments for complex logic
- Test your changes thoroughly

## 🐛 Troubleshooting

### Common Issues

#### Gemini API Errors
```
Error: API key not found
Solution: Check your .env file and ensure GEMINI_API_KEY is set correctly
```

#### MongoDB Connection Issues
```
Error: ServerSelectionTimeoutError
Solution: Verify your MongoDB URI and network connectivity
```

#### Module Import Errors
```
Error: No module named 'llama_index'
Solution: Ensure virtual environment is activated and run pip install -r requirements.txt
```

### Debug Mode
Enable debug mode in `.env`:
```env
FLASK_DEBUG=True
```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Google Gemini**: For providing powerful AI capabilities
- **LlamaIndex**: For excellent AI framework integration
- **GitHub**: For design inspiration
- **MongoDB**: For reliable database services
- **Flask**: For the web framework
- **Primer CSS**: For the styling foundation

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/your-username/hackathon-harvestor/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-username/hackathon-harvestor/discussions)
- **Email**: your-email@example.com

## 🗺️ Roadmap

- [ ] Email notifications for new hackathons
- [ ] Calendar integration
- [ ] Team formation features
- [ ] Advanced filtering and search
- [ ] Mobile app
- [ ] Browser extension
- [ ] Slack/Discord bot integration

---

**Made with ❤️ by [Your Name](https://github.com/your-username)**
