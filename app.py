from flask import Flask, render_template, request, jsonify, redirect, url_for
from pymongo import MongoClient
from bson import ObjectId
import json
import os
from datetime import datetime, timedelta, timezone
import asyncio
from threading import Thread
import logging
import schedule
import time
from apscheduler.schedulers.background import BackgroundScheduler

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
        
    async def search_hackathons(self, query="popular latest hackathons 2024 2025 unstop devfolio hackerearth", limit=10):
        """Search for popular hackathons using Gemini with Google Search"""
        try:
            search_prompt = f"""
            Search for the top {limit} most POPULAR and current hackathons from platforms like Unstop, Devfolio, HackerEarth, 
            MLH, and other hackathon platforms. Focus on hackathons with high participation, good prizes, and from reputable organizations.
            
            Query: {query}
            
            Please extract and return ONLY a valid JSON array with the following format for each hackathon (MAXIMUM {limit} hackathons):
            [
                {{
                    "title": "Exact Hackathon Name",
                    "end_date": "YYYY-MM-DD (registration deadline or event end date - must be future date)",
                    "website_url": "EXACT and WORKING registration/info URL - must be complete with https://",
                    "platform": "unstop/devfolio/hackerearth/mlh/other",
                    "status": "open/upcoming",
                    "description": "Brief description of the hackathon"
                }}
            ]
            
            CRITICAL REQUIREMENTS: 
            - Return ONLY hackathons that are CURRENTLY ACTIVE or UPCOMING
            - Ensure ALL website_url values are COMPLETE, EXACT, and WORKING URLs with https://
            - Verify end_date is in YYYY-MM-DD format and is a FUTURE date
            - Focus on hackathons with VERIFIED registration links
            - Include popular hackathons from major platforms like Unstop.com, Devfolio.co, HackerEarth.com
            - Exclude hackathons that have already ended
            Return only the JSON array, no additional text.
            """
            
            response = await self.llm.acomplete(search_prompt)
            return response.text
            
        except Exception as e:
            logger.error(f"Error in search_hackathons: {str(e)}")
            return "[]"
    
    def parse_hackathon_data(self, raw_data, limit=10):
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
                
                # Limit to specified number
                hackathons = hackathons[:limit]
                
                # Add metadata and clean data
                current_date = datetime.now(timezone.utc)
                valid_hackathons = []
                
                for hackathon in hackathons:
                    # Add metadata
                    hackathon['scraped_at'] = current_date
                    hackathon['source'] = 'gemini_search'
                    
                    # Validate and clean end_date
                    if 'end_date' in hackathon and hackathon['end_date'] != 'TBD':
                        try:
                            # Try to parse and validate the date
                            parsed_date = datetime.strptime(hackathon['end_date'][:10], '%Y-%m-%d')
                            # Only include future hackathons
                            if parsed_date.date() >= current_date.date():
                                hackathon['end_date'] = parsed_date.strftime('%Y-%m-%d')
                                valid_hackathons.append(hackathon)
                        except:
                            # Skip hackathons with invalid dates
                            continue
                    else:
                        # Include hackathons with TBD dates
                        valid_hackathons.append(hackathon)
                
                # Sort by end_date (latest first)
                try:
                    valid_hackathons.sort(key=lambda x: x.get('end_date', '9999-12-31'), reverse=True)
                except:
                    pass
                    
                return valid_hackathons
            return []
        except json.JSONDecodeError as e:
            logger.error(f"JSON decode error: {str(e)}")
            return []
        except Exception as e:
            logger.error(f"Error parsing hackathon data: {str(e)}")
            return []

# Initialize scraper
scraper = HackathonScraper()

# Initialize scheduler for automatic scraping
scheduler = BackgroundScheduler()

def automatic_scrape():
    """Automatically scrape hackathons every 6 hours and append new ones"""
    try:
        logger.info("Starting automatic hackathon scraping...")
        
        def run_scraping():
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            try:
                # First, remove expired hackathons
                remove_expired_hackathons()
                
                raw_data = loop.run_until_complete(scraper.search_hackathons(limit=10))
                hackathons = scraper.parse_hackathon_data(raw_data, limit=10)
                
                if hackathons:
                    # Filter out duplicates based on title and website_url
                    new_hackathons = []
                    for hackathon in hackathons:
                        existing = hackathons_collection.find_one({
                            "$or": [
                                {"title": hackathon["title"]},
                                {"website_url": hackathon.get("website_url")}
                            ]
                        })
                        if not existing:
                            new_hackathons.append(hackathon)
                    
                    if new_hackathons:
                        # Append only new hackathons
                        hackathons_collection.insert_many(new_hackathons)
                        logger.info(f"Automatically scraped and added {len(new_hackathons)} new hackathons")
                    else:
                        logger.info("No new hackathons found during automatic scraping")
                else:
                    logger.warning("No hackathons found during automatic scraping")
            except Exception as e:
                logger.error(f"Automatic scraping error: {str(e)}")
            finally:
                loop.close()
        
        run_scraping()
        
    except Exception as e:
        logger.error(f"Error in automatic_scrape: {str(e)}")

def remove_expired_hackathons():
    """Remove hackathons that have already ended"""
    try:
        current_date = datetime.now().strftime('%Y-%m-%d')
        # Remove hackathons where end_date is before current date
        result = hackathons_collection.delete_many({
            "end_date": {"$lt": current_date, "$ne": "TBD"}
        })
        if result.deleted_count > 0:
            logger.info(f"Removed {result.deleted_count} expired hackathons")
    except Exception as e:
        logger.error(f"Error removing expired hackathons: {str(e)}")

# Schedule automatic scraping every 6 hours
scheduler.add_job(
    func=automatic_scrape,
    trigger="interval",
    hours=6,
    id='hackathon_scraper',
    name='Automatic Hackathon Scraper',
    replace_existing=True
)

# Start the scheduler
scheduler.start()

# Run initial scrape on startup
def initial_scrape():
    """Run initial scrape when the app starts"""
    time.sleep(2)  # Wait for app to fully initialize
    automatic_scrape()

# Start initial scrape in background thread
initial_thread = Thread(target=initial_scrape)
initial_thread.daemon = True
initial_thread.start()

@app.route('/')
def index():
    """Home page showing all hackathons"""
    try:
        # Remove expired hackathons first
        remove_expired_hackathons()
        
        # Get all hackathons sorted by end_date (latest first)
        hackathons = list(hackathons_collection.find().sort("end_date", -1))
        for hackathon in hackathons:
            hackathon['_id'] = str(hackathon['_id'])
        return render_template('index.html', hackathons=hackathons)
    except Exception as e:
        logger.error(f"Error in index route: {str(e)}")
        return render_template('index.html', hackathons=[], error="Failed to load hackathons")

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

@app.route('/search/<hackathon_id>')
def search_hackathon(hackathon_id):
    """Redirect to Google search with relevant keywords for the hackathon"""
    try:
        hackathon = hackathons_collection.find_one({'_id': ObjectId(hackathon_id)})
        if hackathon:
            # Generate relevant search keywords
            keywords = generate_search_keywords(hackathon)
            # Redirect to Google search
            google_search_url = f"https://www.google.com/search?q={keywords}"
            return redirect(google_search_url)
        else:
            return redirect(url_for('index'))
    except Exception as e:
        logger.error(f"Error in search redirect: {str(e)}")
        return redirect(url_for('index'))

def generate_search_keywords(hackathon):
    """Generate relevant search keywords for a hackathon"""
    import urllib.parse
    
    keywords = []
    
    # Add hackathon title (most important)
    if hackathon.get('title'):
        keywords.append(hackathon['title'])
    
    # Add platform for specificity
    if hackathon.get('platform'):
        keywords.append(hackathon['platform'])
    
    # Add year to get current results
    current_year = datetime.now().year
    keywords.append(str(current_year))
    
    # Add "hackathon" and "registration" for relevance
    keywords.extend(['hackathon', 'registration'])
    
    # Join keywords and URL encode
    search_query = ' '.join(keywords)
    return urllib.parse.quote_plus(search_query)

@app.route('/api/hackathons')
def api_hackathons():
    """API endpoint to get all active hackathons"""
    try:
        # Remove expired hackathons first
        remove_expired_hackathons()
        
        # Get all hackathons sorted by end_date (latest first)
        hackathons = list(hackathons_collection.find().sort("end_date", -1))
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

import atexit

def shutdown_scheduler():
    """Shutdown the scheduler gracefully"""
    if scheduler:
        scheduler.shutdown()

atexit.register(shutdown_scheduler)

if __name__ == '__main__':
    try:
        app.run(debug=False, port=5000)
    except KeyboardInterrupt:
        logger.info("Shutting down...")
        shutdown_scheduler()
