from flask import Flask, render_template, request, jsonify, redirect, url_for
from pymongo import MongoClient
from bson import ObjectId
import json
import os
from datetime import datetime, timedelta
import asyncio
from threading import Thread
import logging
from apscheduler.schedulers.background import BackgroundScheduler
import atexit

# Import Gemini and search components
from llama_index.llms.google_genai import GoogleGenAI
from google.genai import types
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

app = Flask(__name__)
app.config['SECRET_KEY'] = 'your-secret-key-here'

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Constants
MAX_HACKATHONS = 10
SCRAPE_INTERVAL_HOURS = 6

# MongoDB Configuration
MONGODB_URI = os.getenv('MONGODB_URI')
MONGODB_DB = os.getenv('MONGODB_DB', 'hackathon_db')

client = MongoClient(MONGODB_URI)
db = client[MONGODB_DB]
hackathons_collection = db.hackathons

# Initialize Gemini with search capabilities
google_search_tool = types.Tool(
    google_search=types.GoogleSearch()
)

llm_with_search = GoogleGenAI(
    model="gemini-2.5-flash",
    generation_config=types.GenerateContentConfig(tools=[google_search_tool])
)

class HackathonScraper:
    def __init__(self):
        self.llm = llm_with_search
        
    async def search_hackathons(self, query="popular trending hackathons 2024 2025 unstop devfolio hackerearth mlh"):
        """Search for popular hackathons using Gemini with Google Search"""
        try:
            search_prompt = f"""
            Search for the most POPULAR and TRENDING current and upcoming hackathons from major platforms like 
            Unstop, Devfolio, HackerEarth, MLH (Major League Hacking), and other well-known hackathon platforms. 
            
            Focus on finding ONLY the most popular hackathons with good prize pools and high participation.
            
            Query: {query}
            
            Please extract and return ONLY a valid JSON array with exactly 10 hackathons in the following format:
            [
                {{
                    "title": "Hackathon Name",
                    "end_date": "YYYY-MM-DD (registration/event end date)",
                    "website_url": "Direct registration/info URL",
                    "organizer": "Organization/Platform name",
                    "platform": "unstop/devfolio/hackerearth/mlh/other",
                    "status": "open/upcoming",
                    "prize_pool": "Prize amount",
                    "popularity_score": 85
                }}
            ]
            
            IMPORTANT: 
            - Return EXACTLY 10 hackathons maximum
            - Focus on POPULAR hackathons with good prizes and high registration numbers
            - Ensure end_date is the latest relevant date (registration deadline or event end date)
            - Only include hackathons that are currently open or upcoming
            - Return only the JSON array, no additional text
            """
            
            response = await self.llm.acomplete(search_prompt)
            return response.text
            
        except Exception as e:
            logger.error(f"Error in search_hackathons: {str(e)}")
            return "[]"
    
    def parse_hackathon_data(self, raw_data):
        """Parse and clean the hackathon data"""
        try:
            # Try to extract JSON from the response
            if isinstance(raw_data, str):
                # Remove any markdown formatting
                clean_data = raw_data.strip()
                if clean_data.startswith('```json'):
                    clean_data = clean_data.replace('```json', '').replace('```', '').strip()
                elif clean_data.startswith('```'):
                    clean_data = clean_data.replace('```', '').strip()
                
                # Parse JSON
                hackathons = json.loads(clean_data)
                
                # Limit to 10 hackathons and add metadata
                hackathons = hackathons[:MAX_HACKATHONS]
                for hackathon in hackathons:
                    hackathon['scraped_at'] = datetime.utcnow()
                    hackathon['source'] = 'gemini_search'
                    # Ensure we have a popularity score
                    if 'popularity_score' not in hackathon:
                        hackathon['popularity_score'] = 75  # Default score
                    
                return hackathons
            return []
        except json.JSONDecodeError as e:
            logger.error(f"JSON decode error: {str(e)}")
            return []
        except Exception as e:
            logger.error(f"Error parsing hackathon data: {str(e)}")
            return []
    
    def clean_old_hackathons(self):
        """Remove hackathons to maintain limit of 10"""
        try:
            total_count = hackathons_collection.count_documents({})
            if total_count > MAX_HACKATHONS:
                # Keep only the most recent ones
                old_hackathons = hackathons_collection.find().sort("scraped_at", 1).limit(total_count - MAX_HACKATHONS)
                for hackathon in old_hackathons:
                    hackathons_collection.delete_one({'_id': hackathon['_id']})
                logger.info(f"Cleaned {total_count - MAX_HACKATHONS} old hackathons")
        except Exception as e:
            logger.error(f"Error cleaning old hackathons: {str(e)}")

    async def auto_scrape_hackathons(self):
        """Automatically scrape hackathons and maintain limit"""
        try:
            logger.info("Starting automatic hackathon scraping...")
            
            # Clear existing hackathons to refresh with new popular ones
            hackathons_collection.delete_many({})
            
            # Search for new hackathons
            raw_data = await self.search_hackathons()
            hackathons = self.parse_hackathon_data(raw_data)
            
            if hackathons:
                # Insert new hackathons
                hackathons_collection.insert_many(hackathons)
                logger.info(f"Auto-scraped and inserted {len(hackathons)} popular hackathons")
                
                # Ensure we don't exceed the limit
                self.clean_old_hackathons()
            else:
                logger.warning("No hackathons found during auto-scrape")
                
        except Exception as e:
            logger.error(f"Error in auto_scrape_hackathons: {str(e)}")

def run_auto_scrape():
    """Function to run auto scraping in a separate thread"""
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        loop.run_until_complete(scraper.auto_scrape_hackathons())
    except Exception as e:
        logger.error(f"Error in run_auto_scrape: {str(e)}")
    finally:
        loop.close()
                    hackathon['scraped_at'] = datetime.utcnow()
                    hackathon['source'] = 'gemini_search'
                    
                return hackathons
            return []
        except json.JSONDecodeError as e:
            logger.error(f"JSON decode error: {str(e)}")
            return []
        except Exception as e:
            logger.error(f"Error parsing hackathon data: {str(e)}")
            return []

# Initialize scraper
scraper = HackathonScraper()

@app.route('/')
def index():
    """Home page showing all hackathons"""
    try:
        hackathons = list(hackathons_collection.find().sort("scraped_at", -1))
        for hackathon in hackathons:
            hackathon['_id'] = str(hackathon['_id'])
        return render_template('index.html', hackathons=hackathons)
    except Exception as e:
        logger.error(f"Error in index route: {str(e)}")
        return render_template('index.html', hackathons=[], error="Failed to load hackathons")

@app.route('/scrape', methods=['POST'])
def scrape_hackathons():
    """Scrape hackathons endpoint"""
    try:
        query = request.json.get('query', 'latest hackathons 2024 2025 unstop devfolio')
        
        # Run async function in a new thread
        def run_scraping():
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            try:
                raw_data = loop.run_until_complete(scraper.search_hackathons(query))
                hackathons = scraper.parse_hackathon_data(raw_data)
                
                if hackathons:
                    # Insert into database
                    hackathons_collection.insert_many(hackathons)
                    logger.info(f"Inserted {len(hackathons)} hackathons")
                    return {'success': True, 'count': len(hackathons)}
                else:
                    return {'success': False, 'error': 'No hackathons found'}
            except Exception as e:
                logger.error(f"Scraping error: {str(e)}")
                return {'success': False, 'error': str(e)}
            finally:
                loop.close()
        
        # For simplicity, run synchronously (in production, use Celery or similar)
        result = run_scraping()
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"Error in scrape endpoint: {str(e)}")
        return jsonify({'success': False, 'error': str(e)})

@app.route('/hackathon/<hackathon_id>')
def view_hackathon(hackathon_id):
    """View single hackathon details"""
    try:
        hackathon = hackathons_collection.find_one({'_id': ObjectId(hackathon_id)})
        if hackathon:
            hackathon['_id'] = str(hackathon['_id'])
            return render_template('hackathon_detail.html', hackathon=hackathon)
        else:
            return redirect(url_for('index'))
    except Exception as e:
        logger.error(f"Error viewing hackathon: {str(e)}")
        return redirect(url_for('index'))

@app.route('/edit/<hackathon_id>')
def edit_hackathon(hackathon_id):
    """Edit hackathon page"""
    try:
        hackathon = hackathons_collection.find_one({'_id': ObjectId(hackathon_id)})
        if hackathon:
            hackathon['_id'] = str(hackathon['_id'])
            return render_template('edit_hackathon.html', hackathon=hackathon)
        else:
            return redirect(url_for('index'))
    except Exception as e:
        logger.error(f"Error loading edit page: {str(e)}")
        return redirect(url_for('index'))

@app.route('/update/<hackathon_id>', methods=['POST'])
def update_hackathon(hackathon_id):
    """Update hackathon"""
    try:
        update_data = {
            'title': request.form.get('title'),
            'description': request.form.get('description'),
            'organizer': request.form.get('organizer'),
            'registration_deadline': request.form.get('registration_deadline'),
            'event_date': request.form.get('event_date'),
            'prize_pool': request.form.get('prize_pool'),
            'website_url': request.form.get('website_url'),
            'platform': request.form.get('platform'),
            'status': request.form.get('status'),
            'eligibility': request.form.get('eligibility'),
            'updated_at': datetime.utcnow()
        }
        
        # Handle tags
        tags = request.form.get('tags', '')
        if tags:
            update_data['tags'] = [tag.strip() for tag in tags.split(',')]
        
        hackathons_collection.update_one(
            {'_id': ObjectId(hackathon_id)},
            {'$set': update_data}
        )
        
        return redirect(url_for('view_hackathon', hackathon_id=hackathon_id))
    except Exception as e:
        logger.error(f"Error updating hackathon: {str(e)}")
        return redirect(url_for('edit_hackathon', hackathon_id=hackathon_id))

@app.route('/delete/<hackathon_id>', methods=['POST'])
def delete_hackathon(hackathon_id):
    """Delete hackathon"""
    try:
        hackathons_collection.delete_one({'_id': ObjectId(hackathon_id)})
        return jsonify({'success': True})
    except Exception as e:
        logger.error(f"Error deleting hackathon: {str(e)}")
        return jsonify({'success': False, 'error': str(e)})

@app.route('/api/hackathons')
def api_hackathons():
    """API endpoint to get all hackathons"""
    try:
        hackathons = list(hackathons_collection.find())
        for hackathon in hackathons:
            hackathon['_id'] = str(hackathon['_id'])
            # Convert datetime objects to strings
            if 'scraped_at' in hackathon:
                hackathon['scraped_at'] = hackathon['scraped_at'].isoformat()
            if 'updated_at' in hackathon:
                hackathon['updated_at'] = hackathon['updated_at'].isoformat()
        return jsonify(hackathons)
    except Exception as e:
        logger.error(f"Error in API endpoint: {str(e)}")
        return jsonify({'error': str(e)})

if __name__ == '__main__':
    app.run(debug=True, port=5000)
