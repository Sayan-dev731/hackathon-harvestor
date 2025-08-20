const { GoogleGenerativeAI } = require('@google/generative-ai');
const axios = require('axios');
const cheerio = require('cheerio');

class GeminiService {
    constructor() {
        if (!process.env.GEMINI_API_KEY) {
            throw new Error('GEMINI_API_KEY is required');
        }
        this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
        this.promptTemplate = `
        You are an expert hackathon data extraction system. Your task is to analyze website content and extract ALL hackathons, competition-related information in a comprehensive JSON format.

        CRITICAL INSTRUCTIONS:
        1. Extract ALL hackathons found on the page, not just one
        2. Look for multiple events, competitions, challenges
        3. If a page lists many hackathons, extract data for each one
        4. If information is missing, use "Not available" for that field
        5. Provide confidence scores based on data quality
        6. Return valid JSON only
        7. Extract lists (sponsors, judges, tracks, etc.) with multiple items when available
        8. Be thorough - extract every hackathon event you can identify
        9. Look for upcoming, current, and recently past events
        10. Include virtual, hybrid, and in-person events
        11. Extract prize information for all competition tracks/categories
        12. Provide comprehensive descriptions, not brief summaries

        Return a JSON object with this exact structure:
        {
          "confidence": 0.85,
          "hackathons": [
            {
              "title": "Hackathon Name",
              "description": "Detailed description of the hackathon, its goals, and what participants will work on",
              "startDate": "2024-MM-DD",
              "endDate": "2024-MM-DD",
              "registrationDeadline": "2024-MM-DD",
              "website": "https://example.com",
              "location": {
                "type": "In-person|Virtual|Hybrid",
                "venue": "Venue name",
                "city": "City",
                "country": "Country",
                "address": "Full address if available"
              },
              "organizer": {
                "name": "Organization name",
                "contact": "email@example.com",
                "website": "https://organizer.com"
              },
              "themes": ["AI/ML", "Blockchain", "FinTech", "HealthTech", "ClimateChange"],
              "tracks": [
                {
                  "name": "Track name",
                  "description": "Track description",
                  "prizes": ["1st: $X", "2nd: $Y", "3rd: $Z"]
                }
              ],
              "eligibility": {
                "ageRestriction": "18+",
                "teamSize": "1-4 members",
                "requirements": ["Student status", "Specific skills", "etc."]
              },
              "prizes": {
                "totalPool": "$50,000",
                "breakdown": [
                  {
                    "category": "Overall Winner",
                    "amount": "$10,000",
                    "description": "Grand prize description"
                  }
                ]
              },
              "sponsors": [
                {
                  "name": "Company Name",
                  "tier": "Gold|Silver|Bronze|Title",
                  "website": "https://sponsor.com"
                }
              ],
              "judges": [
                {
                  "name": "Judge Name",
                  "title": "Position",
                  "company": "Company",
                  "bio": "Brief bio or expertise area"
                }
              ],
              "timeline": [
                {
                  "date": "2024-MM-DD",
                  "time": "HH:MM",
                  "event": "Registration opens",
                  "description": "Event description"
                }
              ],
              "resources": {
                "apis": ["List of APIs provided"],
                "datasets": ["Available datasets"],
                "tools": ["Recommended tools"],
                "mentorship": "Mentorship details"
              },
              "format": {
                "duration": "48 hours",
                "teamFormation": "Individual signup or pre-formed teams",
                "submissionFormat": "Demo video + code + presentation"
              },
              "difficulty": "Beginner|Intermediate|Advanced|All levels",
              "registrationFee": "$0 (Free)|$X",
              "capacity": "500 participants",
              "tags": ["hackathon", "competition", "innovation", "technology"]
            }
          ],
          "metadata": {
            "extractedAt": "2024-01-01T00:00:00Z",
            "sourceUrl": "https://source-website.com",
            "totalHackathonsFound": 5,
            "dataQuality": "High|Medium|Low",
            "extractionNotes": "Any relevant notes about the extraction process"
          }
        }

        IMPORTANT VALIDATION RULES:
        - Ensure all dates are in YYYY-MM-DD format
        - If exact dates are not available, use "Not available"
        - Confidence score should reflect data completeness (0.1-1.0)
        - Extract multiple hackathons when present on the page
        - Provide detailed information for each field
        - Return only valid JSON, no additional text

        Website content to analyze:
        `;
    }

    async extractWebsiteContent(url) {
        try {
            console.log(`Extracting content from: ${url}`);

            const response = await axios.get(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.5',
                    'Accept-Encoding': 'gzip, deflate',
                    'Connection': 'keep-alive',
                    'Upgrade-Insecure-Requests': '1'
                },
                timeout: 15000,
                maxRedirects: 5,
                validateStatus: function (status) {
                    return status >= 200 && status < 300;
                }
            });

            console.log(`Response received with status: ${response.status}`);

            const $ = cheerio.load(response.data);

            // Remove script and style elements and unwanted content
            $('script, style, nav, footer, header, .sidebar, .advertisement, .cookie-banner, .popup, .modal').remove();

            // Extract text content with better cleaning
            let textContent = $('body').text()
                .replace(/\s+/g, ' ')
                .replace(/\n+/g, ' ')
                .trim();

            // Limit content but try to keep it meaningful
            if (textContent.length > 15000) {
                // Try to find a good breaking point
                const sentences = textContent.split('. ');
                let truncated = '';
                for (const sentence of sentences) {
                    if ((truncated + sentence).length > 15000) break;
                    truncated += sentence + '. ';
                }
                textContent = truncated.trim();
            }

            console.log(`Extracted ${textContent.length} characters of text content`);

            // Extract structured data
            const structuredData = this.extractStructuredData($);

            console.log(`Found ${structuredData.headings.length} headings, ${structuredData.links.length} relevant links`);

            return {
                textContent,
                structuredData,
                url
            };
        } catch (error) {
            console.error(`Error extracting website content from ${url}:`, error.message);
            if (error.response) {
                console.error(`HTTP Status: ${error.response.status}`);
                console.error(`Response headers:`, error.response.headers);
            }
            throw error;
        }
    }

    extractStructuredData($) {
        const structured = {
            title: $('title').text() || $('h1').first().text(),
            headings: [],
            links: [],
            dates: [],
            emails: []
        };

        // Extract headings
        $('h1, h2, h3, h4, h5, h6').each((i, el) => {
            const text = $(el).text().trim();
            if (text) structured.headings.push(text);
        });

        // Extract relevant links
        $('a[href]').each((i, el) => {
            const href = $(el).attr('href');
            const text = $(el).text().trim();
            if (href && text && (href.includes('register') || href.includes('apply') || href.includes('submit'))) {
                structured.links.push({ href, text });
            }
        });

        // Extract dates
        const dateRegex = /\b\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}\b|\b\w+\s+\d{1,2},?\s+\d{4}\b|\b\d{4}-\d{2}-\d{2}\b/g;
        const pageText = $('body').text();
        const foundDates = pageText.match(dateRegex);
        if (foundDates) {
            structured.dates = [...new Set(foundDates)].slice(0, 10);
        }

        // Extract email addresses
        const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
        const foundEmails = pageText.match(emailRegex);
        if (foundEmails) {
            structured.emails = [...new Set(foundEmails)].slice(0, 5);
        }

        return structured;
    }

    async analyzeContent(content, sourceUrl) {
        try {
            // Check if we can make a request
            const canRequest = await this.canMakeRequest();
            if (!canRequest) {
                throw new Error('Daily API request limit exceeded');
            }

            const prompt = `${this.promptTemplate}

            SOURCE URL: ${sourceUrl}
            
            WEBSITE CONTENT:
            ${content.textContent}
            
            STRUCTURED DATA:
            Title: ${content.structuredData.title}
            Headings: ${content.structuredData.headings.join(', ')}
            Registration Links: ${content.structuredData.links.map(l => l.text + ' -> ' + l.href).join(', ')}
            Found Dates: ${content.structuredData.dates.join(', ')}
            Contact Emails: ${content.structuredData.emails.join(', ')}
            
            Extract ALL hackathon information from this content. Be thorough and comprehensive.`;

            console.log(`Making Gemini API request for: ${sourceUrl}`);
            console.log(`Content length: ${content.textContent.length} characters`);
            console.log(`Headings found: ${content.structuredData.headings.length}`);

            // Make the API request
            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();

            console.log(`Gemini response received, length: ${text.length} characters`);

            // Log successful API request
            await this.logApiRequest(sourceUrl, true);

            // Clean and parse the response
            let cleanedText = text.trim();

            // Remove any markdown formatting
            cleanedText = cleanedText.replace(/```json\s*|\s*```/g, '');
            cleanedText = cleanedText.replace(/^```\s*|\s*```$/g, '');

            console.log(`Cleaned response preview: ${cleanedText.substring(0, 200)}...`);

            // Try to parse the JSON
            let parsedData;
            try {
                parsedData = JSON.parse(cleanedText);
                console.log(`Successfully parsed JSON with ${parsedData.hackathons?.length || 0} hackathons`);
            } catch (parseError) {
                console.error('JSON parse error:', parseError.message);
                console.error('Raw response preview:', cleanedText.substring(0, 500));

                // Attempt to extract JSON from response if it's embedded in text
                const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    try {
                        parsedData = JSON.parse(jsonMatch[0]);
                        console.log(`Successfully parsed JSON from match with ${parsedData.hackathons?.length || 0} hackathons`);
                    } catch (secondParseError) {
                        console.error('Second parse attempt failed:', secondParseError.message);
                        throw new Error(`Unable to parse LLM response as JSON: ${secondParseError.message}`);
                    }
                } else {
                    console.error('No JSON pattern found in response');
                    throw new Error('No valid JSON found in LLM response');
                }
            }

            // Validate the structure
            if (!parsedData.hackathons || !Array.isArray(parsedData.hackathons)) {
                console.error('Invalid response structure: missing hackathons array');
                console.error('Parsed data keys:', Object.keys(parsedData));
                throw new Error('Invalid response structure: missing hackathons array');
            }

            // Ensure confidence score exists
            if (typeof parsedData.confidence !== 'number') {
                parsedData.confidence = 0.5; // Default confidence
            }

            console.log(`Analysis completed successfully for ${sourceUrl}`);
            return parsedData;

        } catch (error) {
            console.error('Error analyzing content with Gemini:', error.message);
            console.error('Full error:', error);
            // Log failed API request
            await this.logApiRequest(sourceUrl, false);
            throw error;
        }
    }

    async extractHackathonData(url) {
        try {
            console.log(`Extracting hackathon data from: ${url}`);

            // Extract website content
            const content = await this.extractWebsiteContent(url);

            // Analyze with Gemini
            const analysisResult = await this.analyzeContent(content, url);

            console.log(`Found ${analysisResult.hackathons.length} hackathons from ${url}`);

            return {
                success: true,
                url,
                data: analysisResult,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            console.error(`Failed to extract hackathon data from ${url}:`, error.message);
            return {
                success: false,
                url,
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    // Helper method to validate extracted data
    validateHackathonData(hackathon) {
        const required = ['title', 'description'];
        const missing = required.filter(field => !hackathon[field] || hackathon[field] === '');

        if (missing.length > 0) {
            console.warn(`Missing required fields for hackathon: ${missing.join(', ')}`);
            return false;
        }

        // Validate date formats if provided
        const dateFields = ['startDate', 'endDate', 'registrationDeadline'];
        for (const field of dateFields) {
            if (hackathon[field] && hackathon[field] !== 'Not available') {
                const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
                if (!dateRegex.test(hackathon[field])) {
                    console.warn(`Invalid date format for ${field}: ${hackathon[field]}`);
                    hackathon[field] = 'Not available';
                }
            }
        }

        return true;
    }

    // Helper method to clean and normalize data
    normalizeHackathonData(hackathon) {
        // Ensure required fields have default values
        hackathon.title = hackathon.title || 'Untitled Hackathon';
        hackathon.description = hackathon.description || 'No description available';
        hackathon.startDate = hackathon.startDate || 'Not available';
        hackathon.endDate = hackathon.endDate || 'Not available';
        hackathon.location = hackathon.location || { type: 'Not specified' };
        hackathon.themes = hackathon.themes || [];
        hackathon.tags = hackathon.tags || ['hackathon'];

        // Ensure arrays are actually arrays
        if (!Array.isArray(hackathon.themes)) hackathon.themes = [];
        if (!Array.isArray(hackathon.tags)) hackathon.tags = ['hackathon'];
        if (!Array.isArray(hackathon.sponsors)) hackathon.sponsors = [];
        if (!Array.isArray(hackathon.judges)) hackathon.judges = [];

        return hackathon;
    }

    // Map extracted data to database schema
    mapToDbSchema(extractedHackathon, sourceUrl = '') {
        try {
            // Parse dates if they exist and are valid
            const parseDate = (dateStr) => {
                if (!dateStr || dateStr === 'Not available') return null;
                const parsed = new Date(dateStr);
                return isNaN(parsed.getTime()) ? null : parsed;
            };

            // Extract location information
            const locationInfo = extractedHackathon.location || {};
            const locationString = locationInfo.city && locationInfo.country
                ? `${locationInfo.city}, ${locationInfo.country}`
                : locationInfo.venue || locationInfo.type || 'Online';

            // Map mode from location type
            const mapMode = (locationType) => {
                if (!locationType) return 'Online';
                const type = locationType.toLowerCase();
                if (type.includes('virtual') || type.includes('online')) return 'Online';
                if (type.includes('hybrid')) return 'Hybrid';
                if (type.includes('person') || type.includes('physical')) return 'Offline';
                return 'Online';
            };

            // Extract contact information
            const organizer = extractedHackathon.organizer || {};
            const contactInfo = {
                email: organizer.contact || organizer.email || '',
                phone: organizer.phone || '',
                social: {
                    twitter: organizer.social?.twitter || '',
                    linkedin: organizer.social?.linkedin || '',
                    discord: organizer.social?.discord || ''
                }
            };

            // Map prizes to the database format
            const mapPrizes = (prizesData) => {
                if (!prizesData) return [];

                let prizeArray = [];

                // Handle different prize formats
                if (prizesData.breakdown && Array.isArray(prizesData.breakdown)) {
                    prizeArray = prizesData.breakdown.map(prize => ({
                        position: prize.category || prize.position || 'Winner',
                        amount: prize.amount || 'Not specified',
                        description: prize.description || ''
                    }));
                } else if (Array.isArray(prizesData)) {
                    prizeArray = prizesData.map((prize, index) => ({
                        position: prize.position || `Position ${index + 1}`,
                        amount: prize.amount || prize,
                        description: prize.description || ''
                    }));
                }

                return prizeArray;
            };

            // Map eligibility
            const mapEligibility = (eligibilityData) => {
                if (!eligibilityData) return '';
                if (typeof eligibilityData === 'string') return eligibilityData;

                let eligibilityText = '';
                if (eligibilityData.ageRestriction) eligibilityText += `Age: ${eligibilityData.ageRestriction}; `;
                if (eligibilityData.teamSize) eligibilityText += `Team Size: ${eligibilityData.teamSize}; `;
                if (eligibilityData.requirements && Array.isArray(eligibilityData.requirements)) {
                    eligibilityText += `Requirements: ${eligibilityData.requirements.join(', ')}`;
                }

                return eligibilityText.trim();
            };

            // Determine status based on dates
            const determineStatus = (startDate, endDate) => {
                if (!startDate || !endDate) return 'upcoming';

                const now = new Date();
                const start = new Date(startDate);
                const end = new Date(endDate);

                if (isNaN(start.getTime()) || isNaN(end.getTime())) return 'upcoming';

                if (now < start) return 'upcoming';
                if (now >= start && now <= end) return 'ongoing';
                if (now > end) return 'completed';

                return 'upcoming';
            };

            // Map the data to database schema
            const mappedData = {
                name: extractedHackathon.title || 'Untitled Hackathon',
                description: extractedHackathon.description || 'No description available',
                website: extractedHackathon.website || sourceUrl || '',
                startDate: parseDate(extractedHackathon.startDate),
                endDate: parseDate(extractedHackathon.endDate),
                registrationDeadline: parseDate(extractedHackathon.registrationDeadline),
                location: locationString,
                mode: mapMode(locationInfo.type),
                prizes: mapPrizes(extractedHackathon.prizes),
                eligibility: mapEligibility(extractedHackathon.eligibility),
                themes: Array.isArray(extractedHackathon.themes) ? extractedHackathon.themes : [],
                organizer: organizer.name || organizer.organization || '',
                contactInfo: contactInfo,
                registrationLink: extractedHackathon.registrationLink || '',
                status: determineStatus(extractedHackathon.startDate, extractedHackathon.endDate),
                participants: {
                    current: 0,
                    max: extractedHackathon.capacity ? parseInt(extractedHackathon.capacity) : null
                },
                extractedAt: new Date(),
                lastUpdated: new Date()
            };

            // Remove null dates to let MongoDB use defaults or skip
            if (!mappedData.startDate) delete mappedData.startDate;
            if (!mappedData.endDate) delete mappedData.endDate;
            if (!mappedData.registrationDeadline) delete mappedData.registrationDeadline;

            return mappedData;
        } catch (error) {
            console.error('Error mapping hackathon data to database schema:', error);
            throw error;
        }
    }

    // Get remaining API requests for the day (mock implementation)
    async getRemainingRequests() {
        try {
            console.log('Getting remaining requests...');
            // Since Gemini API doesn't provide usage endpoint, we'll track it locally
            const RequestLog = require('../models/requestLog');
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const dailyLimit = parseInt(process.env.DAILY_REQUEST_LIMIT) || 1000;
            console.log('Daily limit:', dailyLimit);

            // Find or create today's log entry
            const todayLog = await RequestLog.findOne({
                date: { $gte: today, $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000) },
                apiProvider: 'gemini'
            });

            const usedRequests = todayLog ? todayLog.requestCount : 0;
            const remaining = Math.max(0, dailyLimit - usedRequests);
            console.log('Used requests:', usedRequests, 'Remaining:', remaining);
            return remaining;
        } catch (error) {
            console.error('Error getting remaining requests:', error);
            return 500; // Default fallback
        }
    }

    // Log API request usage
    async logApiRequest(url, success = true) {
        try {
            const RequestLog = require('../models/requestLog');
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            // Only log successful requests to the count
            if (success) {
                await RequestLog.findOneAndUpdate(
                    {
                        date: { $gte: today, $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000) },
                        apiProvider: 'gemini'
                    },
                    {
                        $inc: { requestCount: 1 },
                        $setOnInsert: { date: today, apiProvider: 'gemini' }
                    },
                    { upsert: true, new: true }
                );
            }
        } catch (error) {
            console.error('Error logging API request:', error);
        }
    }

    // Check if we've exceeded daily limits
    async canMakeRequest() {
        try {
            const remaining = await this.getRemainingRequests();
            return remaining > 0;
        } catch (error) {
            console.error('Error checking request limits:', error);
            return true; // Allow requests if check fails
        }
    }
}

module.exports = GeminiService;
