# Hackathon Aggregator - Optimized with Admin Authentication

A modern hackathon aggregator with AI-powered scraping using Google Search and Gemini 2.5 Flash LLM for intelligent data extraction and processing.

## 🚀 Features

- **Fast AI-powered hackathon search** using Google Search + Gemini 2.5 Flash
- **Admin-only search functionality** with authentication
- **Optimized JSON responses** with proper formatting
- **Website link validation** and extraction
- **Structured data storage** in MongoDB
- **Public hackathon browsing** for regular users
- **Real-time hackathon discovery** with confidence scoring
- **Category-based filtering** and location search
- **Trend analysis** for hackathon insights

## 🔐 Authentication System

### Admin Access
- **Search functionality requires admin authentication**
- **Admin credentials**: Set `ADMIN_ID` and `ADMIN_PASSWORD` in `.env`
- **Default credentials**: `admin` / `admin123`

### User Access
- **Regular users can browse stored hackathons** at `/api/hackathons`
- **No authentication required** for viewing data
- **Search functionality is restricted** to admins only

## 📁 Project Structure

```
├── server.js              # Main server file
├── middleware/
│   └── auth.js            # Authentication middleware
├── models/
│   ├── hackathon.js       # Hackathon schema
│   ├── requestLog.js      # Request logging
│   └── websiteConfig.js   # Website configuration
├── routes/
│   ├── admin.js           # Admin routes
│   ├── hackathons.js      # Public hackathon routes
│   └── search.js          # Admin search routes
├── services/
│   └── modernGeminiService.js # AI service with Gemini 2.5 Flash
└── public/
    ├── index.html         # Frontend
    ├── modern-script.js   # Frontend logic
    └── modern-styles.css  # Styling
```

## 🛠 Setup Instructions

1. **Clone the repository**
```bash
git clone <repository-url>
cd hackathon-aggregator
```

2. **Install dependencies**
```bash
npm install
```

3. **Set up environment variables**
Create a `.env` file with:
```env
MONGODB_URI=your_mongodb_connection_string
GEMINI_API_KEY=your_gemini_api_key
ADMIN_ID=admin
ADMIN_PASSWORD=admin123
PORT=3001
```

4. **Start the server**
```bash
npm run dev
```

## 📡 API Endpoints

### 🔓 Public Endpoints (No Authentication Required)

#### Get All Hackathons
```http
GET /api/hackathons
```
**Query Parameters:**
- `search` - Text search across hackathon fields
- `status` - Filter by status (upcoming, ongoing, completed)
- `mode` - Filter by mode (Online, Offline, Hybrid)
- `startDate` - Filter by start date (YYYY-MM-DD)
- `endDate` - Filter by end date (YYYY-MM-DD)
- `location` - Filter by location
- `page` - Page number (default: 1)
- `limit` - Results per page (default: 12)
- `sortBy` - Sort field (default: startDate)
- `sortOrder` - Sort order (asc/desc, default: asc)

#### Get Search Categories
```http
GET /api/search/categories
```
Returns available search categories for hackathons.

### 🔐 Admin-Only Endpoints (Authentication Required)

#### Admin Authentication
Include admin credentials in query parameters:
- `admin_id=admin`
- `admin_password=admin123`

#### Admin Custom Search (NEW)
```http
POST /api/search/admin?admin_id=admin&admin_password=admin123
Content-Type: application/json

{
  "query": "AI hackathons San Francisco 2024",
  "prompt": "Find AI and machine learning hackathons in San Francisco with cash prizes over $10,000. Focus on getting complete website links and registration deadlines.",
  "limit": 5,
  "save": true
}
```

#### Admin General Search
```http
GET /api/search/hackathons?admin_id=admin&admin_password=admin123&query=blockchain hackathons&limit=10&save=true
```

#### Trend Analysis
```http
GET /api/search/trends?admin_id=admin&admin_password=admin123
```

## 🤖 How the AI Search Works

### 1. Google Search Integration
- Uses Google Search tools to find hackathon information
- Searches official websites and verified sources
- Filters results based on admin prompts

### 2. Gemini 2.5 Flash Processing
- **First pass**: Extracts structured data from search results
- **Second pass**: Processes data according to admin requirements
- **Result**: Clean, formatted JSON with validated website links

### 3. Data Validation
- Confidence scoring for each hackathon
- Website URL validation and formatting
- Date parsing and standardization
- Theme and category extraction

## 📊 Response Format

### Successful Search Response
```json
{
  "success": true,
  "admin": "admin",
  "query": "AI hackathons 2024",
  "limit": 5,
  "data": {
    "hackathons": [
      {
        "title": "AI Innovation Challenge 2024",
        "description": "Global AI hackathon focusing on innovative solutions",
        "startDate": "2024-03-15",
        "endDate": "2024-03-17",
        "registrationDeadline": "2024-03-01",
        "website": "https://ai-innovation-challenge.com",
        "location": {
          "type": "Hybrid",
          "venue": "Tech Hub San Francisco",
          "city": "San Francisco",
          "country": "USA"
        },
        "organizer": {
          "name": "TechCorp Inc.",
          "contact": "contact@techcorp.com"
        },
        "themes": ["AI", "Machine Learning", "Innovation"],
        "prizes": {
          "totalPool": "$100,000",
          "breakdown": [
            {
              "category": "First Place",
              "amount": "$50,000",
              "description": "Grand prize winner"
            }
          ]
        },
        "eligibility": "Open to all developers",
        "registrationFee": "Free",
        "status": "upcoming",
        "confidence": 0.95
      }
    ],
    "metadata": {
      "totalFound": 1,
      "searchQuery": "AI hackathons 2024",
      "adminPrompt": "Find AI hackathons with detailed information",
      "limit": 5,
      "extractedAt": "2024-01-15T10:30:00.000Z",
      "sources": [
        {
          "url": "https://ai-innovation-challenge.com",
          "title": "AI Innovation Challenge 2024"
        }
      ]
    }
  },
  "saved": {
    "count": 1,
    "total": 1,
    "savedBy": "admin"
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## 🔧 Configuration

### Environment Variables
```env
# Database
MONGODB_URI=mongodb://localhost:27017/hackathon-db

# AI Service
GEMINI_API_KEY=your_gemini_api_key_here

# Authentication
ADMIN_ID=admin
ADMIN_PASSWORD=your_secure_password

# Server
PORT=3001
```

### Admin Prompt Examples

1. **Specific Technology Focus**:
   ```
   "Find blockchain and cryptocurrency hackathons with prizes over $20,000. Include DeFi and Web3 events. Make sure to get complete website URLs and social media links."
   ```

2. **Location-based Search**:
   ```
   "Search for hackathons in California universities for 2024. Focus on student competitions with academic partnerships. Get registration deadlines and eligibility requirements."
   ```

3. **Corporate Hackathons**:
   ```
   "Find corporate-sponsored hackathons from major tech companies like Google, Microsoft, Amazon. Include internship opportunities and remote participation options."
   ```

## 🚀 Performance Optimizations

1. **Limited Results**: Default limit of 5-10 results for faster processing
2. **Confidence Scoring**: Results sorted by AI confidence scores
3. **Focused Prompts**: Admin prompts help narrow search scope
4. **Website Validation**: Ensures all URLs are accessible
5. **Efficient Caching**: Database storage prevents repeated searches

## 🔒 Security Features

- Admin authentication required for search functionality
- Input validation and sanitization
- Rate limiting can be added
- Secure credential storage in environment variables

## 📈 Usage Examples

### For Regular Users
```javascript
// Browse hackathons (no auth needed)
fetch('/api/hackathons?status=upcoming&limit=10')
  .then(response => response.json())
  .then(data => console.log(data));
```

### For Admins
```javascript
// Admin search with custom prompt
fetch('/api/search/admin?admin_id=admin&admin_password=admin123', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: 'fintech hackathons NYC 2024',
    prompt: 'Find financial technology hackathons in New York with banking partnerships',
    limit: 3,
    save: true
  })
})
.then(response => response.json())
.then(data => console.log(data));
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

MIT License - feel free to use this project for your own purposes.

---

**Note**: This system is designed to provide accurate, up-to-date hackathon information through AI-powered search. Admin authentication ensures that search resources are used responsibly while allowing regular users to access curated hackathon data.
