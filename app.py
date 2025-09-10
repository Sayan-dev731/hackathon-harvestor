from flask import Flask, render_template, request, jsonify, redirect, url_for
from pymongo import MongoClient
from bson import ObjectId
import json
import os
from datetime import datetime, timedelta
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
                    "title": "Hackathon Name",
                    "end_date": "YYYY-MM-DD (registration deadline or event end date)",
                    "website_url": "Registration/Info URL",
                    "platform": "unstop/devfolio/hackerearth/mlh/other",
                    "status": "open/closed/upcoming",
                    "scraped_at": "{datetime.utcnow().isoformat()}"
                }}
            ]
            
            IMPORTANT: 
            - Return ONLY the most popular hackathons with active registrations
            - Focus on hackathons with the latest end dates
            - Return MAXIMUM {limit} hackathons
            - Sort by end_date (latest first)
            - Include only hackathons that are currently open or upcoming
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
                for hackathon in hackathons:
                    hackathon['scraped_at'] = datetime.utcnow()
                    hackathon['source'] = 'gemini_search'
                    
                    # Ensure end_date is properly formatted
                    if 'end_date' in hackathon:
                        try:
                            # Try to parse and reformat the date
                            parsed_date = datetime.strptime(hackathon['end_date'][:10], '%Y-%m-%d')
                            hackathon['end_date'] = parsed_date.strftime('%Y-%m-%d')
                        except:
                            # Keep original if parsing fails
                            pass
                
                # Sort by end_date (latest first)
                try:
                    hackathons.sort(key=lambda x: x.get('end_date', ''), reverse=True)
                except:
                    pass
                    
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

# Initialize scheduler for automatic scraping
scheduler = BackgroundScheduler()

def automatic_scrape():
    """Automatically scrape hackathons every 6 hours"""
    try:
        logger.info("Starting automatic hackathon scraping...")
        
        def run_scraping():
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            try:
                raw_data = loop.run_until_complete(scraper.search_hackathons(limit=10))
                hackathons = scraper.parse_hackathon_data(raw_data, limit=10)
                
                if hackathons:
                    # Clear old hackathons and insert new ones
                    hackathons_collection.delete_many({})
                    hackathons_collection.insert_many(hackathons)
                    logger.info(f"Automatically scraped and stored {len(hackathons)} hackathons")
                else:
                    logger.warning("No hackathons found during automatic scraping")
            except Exception as e:
                logger.error(f"Automatic scraping error: {str(e)}")
            finally:
                loop.close()
        
        run_scraping()
        
    except Exception as e:
        logger.error(f"Error in automatic_scrape: {str(e)}")

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
    """Home page showing top 10 popular hackathons"""
    try:
        # Get hackathons sorted by end_date (latest first), limit to 10
        hackathons = list(hackathons_collection.find().sort("end_date", -1).limit(10))
        for hackathon in hackathons:
            hackathon['_id'] = str(hackathon['_id'])
        return render_template('index.html', hackathons=hackathons)
    except Exception as e:
        logger.error(f"Error in index route: {str(e)}")
        return render_template('index.html', hackathons=[], error="Failed to load hackathons")

@app.route('/scrape', methods=['POST'])
def scrape_hackathons():
    """Scrape hackathons endpoint - limited to 10 popular hackathons"""
    try:
        query = request.json.get('query', 'popular latest hackathons 2024 2025 unstop devfolio')
        
        # Run async function in a new thread
        def run_scraping():
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            try:
                raw_data = loop.run_until_complete(scraper.search_hackathons(query, limit=10))
                hackathons = scraper.parse_hackathon_data(raw_data, limit=10)
                
                if hackathons:
                    # Clear existing hackathons and insert new ones (maintain only 10)
                    hackathons_collection.delete_many({})
                    hackathons_collection.insert_many(hackathons)
                    logger.info(f"Inserted {len(hackathons)} popular hackathons")
                    return {'success': True, 'count': len(hackathons)}
                else:
                    return {'success': False, 'error': 'No popular hackathons found'}
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
    """API endpoint to get top 10 popular hackathons"""
    try:
        hackathons = list(hackathons_collection.find().sort("end_date", -1).limit(10))
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
        app.run(debug=True, port=5000)
    except KeyboardInterrupt:
        logger.info("Shutting down...")
        shutdown_scheduler()
