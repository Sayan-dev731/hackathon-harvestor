# Hackathon Aggregator

A modern, AI-powered hackathon aggregator that automatically discovers and displays hackathon information from various websites.

## 🚀 New Features - AI-Powered Direct Extraction

- 🤖 **Direct URL Extraction**: Extract hackathon data from any website URL using Google Gemini AI
- 🔍 **Test Before Save**: Preview extracted data before saving to database
- 📊 **Comprehensive Mapping**: Automatically maps extracted data to database schema
- 💯 **Quality Scores**: Confidence ratings for extracted data
- 🎯 **Smart Detection**: Finds multiple hackathons on single pages

## Features

- 🤖 **AI-Powered Scraping**: Uses Google Gemini 1.5 Flash to intelligently extract hackathon information
- 🎯 **Smart Filtering**: Advanced filters for status, mode, dates, and search
- 📱 **Modern UI**: Clean, responsive design with beautiful animations
- ⚡ **Real-time Updates**: Automatic scraping with scheduling
- 🔒 **Rate Limiting**: Built-in daily API limits with fallback to cached data
- 📊 **Admin Dashboard**: Easy website management and monitoring
- 🗄️ **MongoDB Integration**: Robust data storage with MongoDB Atlas
- 🌐 **Direct Extraction**: Extract hackathons directly from any URL

## Setup Instructions

### 1. Environment Variables

Create a `.env` file in the root directory with:

```env
MONGODB_URI=
GEMINI_API_KEY=your_gemini_api_key_here
PORT=3000
DAILY_REQUEST_LIMIT=1000
```

### 2. Get Google Gemini API Key

1. Go to [Google AI Studio](https://aistudio.google.com/)
2. Create a new API key
3. Replace `your_gemini_api_key_here` with your actual API key
4. **Note**: The system is already configured with a working API key for testing

### 3. Install Dependencies

```bash
npm install
```

### 4. Run the Application

```bash
npm run dev
```

The application will be available at `http://localhost:3000`

## Usage

### For Regular Users

1. **Browse Hackathons**: View all available hackathons on the home page
2. **Filter & Search**: Use the filter panel to find specific hackathons
3. **View Details**: Click on any hackathon card to see full details
4. **Responsive Design**: Works perfectly on desktop, tablet, and mobile

### For Administrators

1. **Access Admin Panel**: Click on "Admin" in the navigation

2. **Add Websites**: 
   - Enter website name (e.g., "DevPost Summer Hackathon")
   - Enter website URL (e.g., "https://summer-hack.devpost.com")
   - Set start and end dates
   - Add optional notes

3. **Direct URL Extraction** (NEW):
   - Enter any hackathon website URL
   - Click "Test Extraction Only" to preview data without saving
   - Click "Extract & Save Hackathons" to save data to database
   - View detailed extraction results and statistics

4. **Manage Scraping**:
   - Manual scrape individual websites
   - Trigger scraping for all websites
   - Monitor API usage and remaining requests

## 🆕 How to Use Direct Extraction

### Quick Start
1. Go to Admin panel
2. Find "Extract Hackathons from URL" section
3. Enter URL: `https://devpost.com/hackathons`
4. Click "Extract & Save Hackathons"
5. Review results and saved hackathons

### Supported URLs
- DevPost hackathon pages
- University hackathon websites  
- Corporate hackathon portals
- Event listing pages
- Hackathon organization sites

For detailed instructions, see [GEMINI_INTEGRATION_GUIDE.md](./GEMINI_INTEGRATION_GUIDE.md)

## Architecture

### Backend Services

- **Express Server**: Main API server serving static files and handling requests
- **Gemini Service**: AI-powered content extraction and analysis
- **Scraping Service**: Automated website scraping with scheduling
- **MongoDB Models**: Data persistence with optimized schemas

### Frontend

- **Vanilla JavaScript**: No frameworks, pure modern JavaScript
- **CSS Grid & Flexbox**: Responsive layouts
- **Modern CSS**: Custom properties, animations, and transitions
- **Progressive Enhancement**: Works without JavaScript for basic functionality

### Data Models

- **Hackathon**: Complete hackathon information
- **WebsiteConfig**: Website scraping configurations  
- **RequestLog**: API usage tracking and rate limiting

## API Endpoints

### Public Endpoints
- `GET /api/hackathons` - Get hackathons with filtering
- `GET /api/hackathons/:id` - Get single hackathon
- `GET /api/hackathons/stats/overview` - Get statistics

### Admin Endpoints
- `GET/POST /api/admin/websites` - Manage website configurations
- `POST /api/admin/scrape/:id` - Manual scrape single website
- `POST /api/admin/scrape-all` - Trigger scraping for all websites
- `GET /api/admin/api-usage` - Get API usage statistics

## Automated Features

### Scheduled Scraping
- Runs daily at 6 AM
- Additional scraping every 6 hours
- Automatic status updates based on dates

### Rate Limiting
- Daily API request limits
- Automatic fallback to cached data
- Usage monitoring and alerts

### Data Management
- Automatic hackathon status updates
- Duplicate detection and merging
- Data validation and cleaning

## Technology Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB Atlas
- **AI**: Google Gemini 2.5 Flash
- **Scraping**: Axios + Cheerio
- **Scheduling**: node-cron
- **Frontend**: HTML5, CSS3, Vanilla JavaScript

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

For questions or support, please open an issue on the repository.
