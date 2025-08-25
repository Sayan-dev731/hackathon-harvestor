const { google } = require("@ai-sdk/google");
const { generateObject, generateText } = require("ai");
const { z } = require("zod");
const Hackathon = require('../models/hackathon');
const ApiUsage = require('../models/apiUsage');

/**
 * Modern Gemini Service with AI SDK and Google Search
 * Implements web search functionality for hackathon discovery with deduplication
 */
class ModernGeminiService {
    constructor() {
        if (!process.env.GEMINI_API_KEY) {
            throw new Error('GEMINI_API_KEY is required in .env file');
        }

        // Initialize with Google provider
        this.model = google("gemini-2.5-flash");

        // Cache for existing hackathons to prevent duplicates
        this.existingHackathons = new Map();
        this.lastCacheUpdate = null;
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutes

        // Define the schema for structured hackathon data
        this.hackathonSchema = z.object({
            hackathons: z.array(
                z.object({
                    title: z.string().describe("Name of the hackathon"),
                    description: z.string().describe("Detailed description of the hackathon"),
                    startDate: z.string().describe("Start date in YYYY-MM-DD format or 'Not available'"),
                    endDate: z.string().describe("End date in YYYY-MM-DD format or 'Not available'"),
                    registrationDeadline: z.string().describe("Registration deadline in YYYY-MM-DD format or 'Not available'"),
                    website: z.string().describe("Official hackathon website URL"),
                    location: z.object({
                        type: z.enum(["In-person", "Virtual", "Hybrid"]).describe("Event format"),
                        venue: z.string().describe("Venue name or 'Online'"),
                        city: z.string().describe("City name or 'N/A'"),
                        country: z.string().describe("Country name or 'N/A'")
                    }),
                    organizer: z.object({
                        name: z.string().describe("Organization or company name"),
                        contact: z.string().describe("Contact email or 'Not available'")
                    }),
                    themes: z.array(z.string()).describe("Array of hackathon themes/tracks"),
                    prizes: z.object({
                        totalPool: z.string().describe("Total prize pool amount"),
                        breakdown: z.array(z.object({
                            category: z.string().describe("Prize category"),
                            amount: z.string().describe("Prize amount"),
                            description: z.string().describe("Prize description")
                        }))
                    }),
                    eligibility: z.string().describe("Eligibility requirements"),
                    registrationFee: z.string().describe("Registration fee or 'Free'"),
                    status: z.enum(["upcoming", "ongoing", "completed"]).describe("Current status"),
                    confidence: z.number().min(0).max(1).describe("Confidence score for extracted data")
                })
            ),
            metadata: z.object({
                totalFound: z.number().describe("Total number of hackathons found"),
                searchQuery: z.string().describe("The search query used"),
                extractedAt: z.string().describe("Extraction timestamp")
            })
        });
    }

    /**
     * Check if API usage is within daily limits
     * @returns {Object} API usage status
     */
    async checkApiLimit() {
        try {
            const apiUsage = await ApiUsage.getTodaysUsage();

            return {
                canMakeRequest: !apiUsage.isLimitReached(),
                currentUsage: apiUsage.geminiApiCalls,
                dailyLimit: apiUsage.dailyLimit,
                remaining: Math.max(0, apiUsage.dailyLimit - apiUsage.geminiApiCalls),
                resetTime: new Date(Date.now() + (24 * 60 * 60 * 1000)).toISOString() // Next day
            };
        } catch (error) {
            console.error('Error checking API limit:', error);
            // Allow request if we can't check the limit
            return {
                canMakeRequest: true,
                currentUsage: 0,
                dailyLimit: 100,
                remaining: 100,
                error: error.message
            };
        }
    }

    /**
     * Increment API usage counter
     */
    async incrementApiUsage() {
        try {
            const apiUsage = await ApiUsage.getTodaysUsage();
            await apiUsage.incrementUsage();
            return apiUsage;
        } catch (error) {
            console.error('Error incrementing API usage:', error);
        }
    }

    /**
     * Search for hackathons using Google Search and extract structured data
     * @param {string} searchQuery - The search query for hackathons
     * @param {number} limit - Maximum number of hackathons to return (default: 10)
     * @param {string} adminPrompt - Additional admin-specific prompt for focused search
     * @returns {Object} Structured hackathon data
     */
    async searchHackathons(searchQuery = "upcoming hackathons 2024 2025 programming coding competition", limit = 10, adminPrompt = null) {
        try {
            // Check API usage limit first
            const apiLimitStatus = await this.checkApiLimit();
            if (!apiLimitStatus.canMakeRequest) {
                return {
                    success: false,
                    error: `Daily API limit reached (${apiLimitStatus.currentUsage}/${apiLimitStatus.dailyLimit}). Try again tomorrow.`,
                    apiUsage: apiLimitStatus,
                    timestamp: new Date().toISOString()
                };
            }

            console.log(`🔍 Searching for hackathons: "${searchQuery}" (limit: ${limit})`);
            console.log(`📊 API Usage: ${apiLimitStatus.currentUsage}/${apiLimitStatus.dailyLimit} (${apiLimitStatus.remaining} remaining)`);

            // Build focused search prompt based on admin requirements
            const focusedPrompt = adminPrompt ?
                `Search the web for ${searchQuery}. 
                
                ADMIN SPECIFIC REQUEST: ${adminPrompt}
                
                CRITICAL: Focus ONLY on finding information that matches the admin's specific requirements.
                MANDATORY: Every hackathon MUST have a valid, accessible official website URL.
                Prioritize official websites and verified sources.
                
                Return concise, accurate information for up to ${limit} most relevant hackathons WITH VALID WEBSITES.` :
                `Search the web for ${searchQuery}. 
                
                CRITICAL REQUIREMENT: Every hackathon MUST have a valid, accessible official website URL.
                
                Focus on finding:
                - Official hackathon websites and announcements
                - University and corporate hackathon events with registration pages
                - Technology competitions with official landing pages
                - Innovation challenges with dedicated websites
                - Recent hackathon listings from verified directories
                
                MANDATORY INFORMATION for each hackathon:
                - Valid, accessible official website URL (REQUIRED)
                - Event dates and deadlines
                - Registration information and links
                - Prize details
                - Organizer information
                - Location and format (virtual/in-person/hybrid)
                - Themes and tracks
                - Eligibility requirements
                
                Return information for up to ${limit} most relevant hackathons that have VALID OFFICIAL WEBSITES.`;

            // Step 1: Search the web for hackathon information
            const { text: searchResults, sources } = await generateText({
                model: this.model,
                tools: {
                    google_search: google.tools.googleSearch({})
                },
                prompt: focusedPrompt
            });

            console.log(`📊 Search completed. Found ${sources?.length || 0} sources`);
            console.log(`📝 Search results length: ${searchResults.length} characters`);

            // Increment API usage after successful search
            await this.incrementApiUsage();

            // Step 2: Extract structured data from search results with admin prompt processing
            const extractionPrompt = adminPrompt ?
                `Analyze the following web search results and extract hackathon information into structured JSON format.

ADMIN SPECIFIC REQUEST: ${adminPrompt}

CRITICAL INSTRUCTIONS:
1. Focus ONLY on hackathons that match the admin's specific requirements
2. Extract a maximum of ${limit} most relevant hackathons
3. MANDATORY: Every hackathon MUST have a valid, accessible official website URL - reject any without valid websites
4. Prioritize hackathons with complete information and verified websites
5. For missing information, use "Not available" or appropriate defaults
6. Ensure all dates are in YYYY-MM-DD format or "Not available"
7. Calculate confidence scores based on completeness and relevance to admin request
8. Determine status based on dates: upcoming (future), ongoing (current), completed (past)
9. Include detailed descriptions that match admin requirements
10. Extract themes/tracks as an array of strings relevant to admin query
11. VALIDATE each website URL - it must be a real, accessible website, not a placeholder

Search Results:
${searchResults}

Sources Found: ${sources?.map(s => s.url).join(', ') || 'None'}

IMPORTANT: Only include hackathons with valid official websites. Reject any with placeholder URLs or "Not available" websites.

Return a focused JSON object with only the most relevant hackathons that have VALID OFFICIAL WEBSITES.` :
                `Analyze the following web search results and extract ALL hackathon information into structured JSON format.

CRITICAL INSTRUCTIONS:
1. Extract up to ${limit} most relevant hackathons from the search results
2. MANDATORY: Every hackathon MUST have a valid, accessible official website URL - reject any without valid websites
3. Prioritize hackathons with complete information and verified websites
4. For missing information, use "Not available" or appropriate defaults
5. Ensure all dates are in YYYY-MM-DD format or "Not available"
6. Calculate confidence scores based on completeness of information
7. Determine status based on dates: upcoming (future), ongoing (current), completed (past)
8. Include detailed descriptions and comprehensive prize information
9. Extract themes/tracks as an array of strings
10. VALIDATE each website URL - it must be a real, accessible website, not a placeholder
11. Ensure website URLs are properly formatted and accessible

Search Results:
${searchResults}

Sources Found: ${sources?.map(s => s.url).join(', ') || 'None'}

IMPORTANT: Only include hackathons with valid official websites. Do not include hackathons without proper website URLs.

Return a comprehensive JSON object with the most relevant hackathons that have VALID OFFICIAL WEBSITES.`;

            const { object: structuredData } = await generateObject({
                model: this.model,
                schema: this.hackathonSchema,
                prompt: extractionPrompt
            });

            // Limit results to requested number
            if (structuredData.hackathons && structuredData.hackathons.length > limit) {
                structuredData.hackathons = structuredData.hackathons
                    .sort((a, b) => b.confidence - a.confidence) // Sort by confidence score
                    .slice(0, limit);
            }

            // Add metadata
            structuredData.metadata = {
                totalFound: structuredData.hackathons.length,
                searchQuery: searchQuery,
                adminPrompt: adminPrompt || "None",
                limit: limit,
                extractedAt: new Date().toISOString(),
                sources: sources?.map(s => ({ url: s.url, title: s.title })) || []
            };

            console.log(`✅ Extraction completed. Found ${structuredData.hackathons.length} hackathons`);

            return {
                success: true,
                data: structuredData,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            console.error('❌ Error in searchHackathons:', error);
            return {
                success: false,
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Admin-specific search with custom prompt (focused on search only)
     * @param {string} searchQuery - The search query for hackathons
     * @param {string} adminPrompt - Admin-specific requirements and search instructions
     * @param {number} limit - Maximum number of results (default: 5 for faster response)
     * @returns {Object} Raw search results (JSON formatting handled by JsonFormatterService)
     */
    async adminSearch(searchQuery, adminPrompt, limit = 5) {
        try {
            console.log(`🔥 Admin search initiated: "${searchQuery}" with custom prompt`);
            console.log(`📋 Admin requirements: "${adminPrompt}"`);

            // Perform focused search based on admin requirements
            const searchResult = await this.searchHackathons(searchQuery, limit, adminPrompt);

            if (!searchResult.success) {
                throw new Error(searchResult.error);
            }

            // Return raw search results without JSON formatting
            // JSON formatting will be handled by JsonFormatterService
            return {
                success: true,
                data: searchResult.data,
                metadata: {
                    ...searchResult.data.metadata,
                    adminPrompt: adminPrompt,
                    searchFocusedBy: "ModernGeminiService",
                    searchTime: new Date().toISOString()
                },
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            console.error('❌ Error in admin search:', error);
            return {
                success: false,
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Search for specific types of hackathons with targeted queries
     * @param {string} category - Category of hackathons to search for
     * @param {number} limit - Maximum number of results
     * @returns {Object} Structured hackathon data
     */
    async searchByCategory(category, limit = 10) {
        const categoryQueries = {
            "ai-ml": "artificial intelligence machine learning AI ML hackathons 2024 2025",
            "blockchain": "blockchain cryptocurrency web3 DeFi NFT hackathons 2024 2025",
            "fintech": "fintech financial technology banking payments hackathons 2024 2025",
            "healthtech": "health technology medical healthcare biotech hackathons 2024 2025",
            "climate": "climate change sustainability environmental green tech hackathons 2024 2025",
            "student": "university college student hackathons 2024 2025 programming",
            "startup": "startup entrepreneurship innovation business hackathons 2024 2025",
            "gaming": "game development gaming esports VR AR hackathons 2024 2025",
            "iot": "internet of things IoT hardware embedded systems hackathons 2024 2025",
            "cybersecurity": "cybersecurity privacy data protection security hackathons 2024 2025"
        };

        const query = categoryQueries[category] || `${category} hackathons 2024 2025`;
        return await this.searchHackathons(query, limit);
    }

    /**
     * Get hackathons from specific regions or locations
     * @param {string} location - Location to search for hackathons
     * @param {number} limit - Maximum number of results
     * @returns {Object} Structured hackathon data
     */
    async searchByLocation(location, limit = 10) {
        const query = `hackathons ${location} 2024 2025 programming coding competition events`;
        return await this.searchHackathons(query, limit);
    }

    /**
     * Get recent hackathon results and past events for analysis
     * @param {number} limit - Maximum number of results
     * @returns {Object} Structured data about completed hackathons
     */
    async searchCompletedHackathons(limit = 10) {
        const query = "recent hackathon results winners 2024 completed programming competitions";
        return await this.searchHackathons(query, limit);
    }

    /**
     * Analyze hackathon trends and generate insights
     * @param {Array} hackathons - Array of hackathon data
     * @returns {Object} Analysis and insights
     */
    async analyzeHackathonTrends(hackathons) {
        try {
            const { text: analysis } = await generateText({
                model: this.model,
                prompt: `Analyze the following hackathon data and provide comprehensive insights:

${JSON.stringify(hackathons, null, 2)}

Provide analysis on:
1. Popular themes and technologies
2. Geographic distribution
3. Prize trends and amounts
4. Organizer patterns
5. Format preferences (virtual vs in-person)
6. Timeline and seasonal patterns
7. Eligibility and accessibility trends
8. Emerging topics and technologies

Return detailed insights with specific examples and data points.`
            });

            return {
                success: true,
                analysis: analysis,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            console.error('Error analyzing trends:', error);
            return {
                success: false,
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Convert extracted hackathon data to database format (only valid websites)
     * @param {Object} hackathonData - Raw hackathon data from extraction
     * @returns {Object} Formatted data for database storage
     */
    mapToDbFormat(hackathonData) {
        const validHackathons = [];

        for (const [index, hackathon] of hackathonData.hackathons.entries()) {
            // Validate website first - skip if invalid
            const website = hackathon.website || '';
            if (!website ||
                website === 'Not available' ||
                website === 'TBD' ||
                website === 'TBA' ||
                website.includes('example.com') ||
                website.includes('placeholder')) {
                console.log(`❌ Skipping hackathon "${hackathon.title || hackathon.name}" - no valid website`);
                continue; // Skip hackathons without valid websites
            }

            const parseDate = (dateStr) => {
                if (!dateStr || dateStr === 'Not available' || dateStr === 'TBD' || dateStr === 'TBA') {
                    return null;
                }
                const date = new Date(dateStr);
                return isNaN(date.getTime()) ? null : date;
            };

            // Handle dates - provide defaults if required dates are missing
            const startDate = parseDate(hackathon.startDate);
            const endDate = parseDate(hackathon.endDate);
            const registrationDeadline = parseDate(hackathon.registrationDeadline);

            // If start date is missing, use a future date
            const defaultStartDate = startDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days from now
            // If end date is missing, use start date + 3 days
            const defaultEndDate = endDate || new Date(defaultStartDate.getTime() + 3 * 24 * 60 * 60 * 1000);

            const validHackathon = {
                name: hackathon.title || `Hackathon ${Date.now()}-${index}`,
                description: hackathon.description || '',
                website: website, // Use the validated website
                startDate: defaultStartDate,
                endDate: defaultEndDate,
                registrationDeadline: registrationDeadline,
                location: `${hackathon.location?.city}, ${hackathon.location?.country}`.replace('N/A, ', '').replace(', N/A', '') || 'Online',
                mode: hackathon.location?.type === 'Virtual' ? 'Online' :
                    hackathon.location?.type === 'In-person' ? 'Offline' : 'Hybrid',
                organizer: hackathon.organizer?.name || 'Unknown Organizer',
                themes: hackathon.themes || [],
                prizes: hackathon.prizes?.breakdown?.map(prize => ({
                    position: prize.category,
                    amount: prize.amount,
                    description: prize.description
                })) || [],
                eligibility: hackathon.eligibility || '',
                status: hackathon.status || 'upcoming',
                extractedAt: new Date(),
                lastUpdated: new Date(),
                confidence: (hackathon.confidence || 0.5) + 0.1, // Boost confidence for valid website
                contactInfo: {
                    email: hackathon.organizer?.contact || '',
                    phone: '',
                    social: {}
                }
            };

            validHackathons.push(validHackathon);
        }

        console.log(`✅ Filtered to ${validHackathons.length} hackathons with valid websites (from ${hackathonData.hackathons.length} total)`);
        return validHackathons;
    }

    /**
     * Update cache with existing hackathons from database
     */
    async updateExistingHackathonsCache() {
        try {
            const now = Date.now();

            // Skip if cache is still fresh
            if (this.lastCacheUpdate && (now - this.lastCacheUpdate) < this.cacheTimeout) {
                return;
            }

            const existingHackathons = await Hackathon.find({}, 'name website organizer startDate endDate').lean();

            // Clear and rebuild cache
            this.existingHackathons.clear();

            existingHackathons.forEach(hackathon => {
                const key = this.generateDeduplicationKey(hackathon);
                this.existingHackathons.set(key, {
                    id: hackathon._id,
                    name: hackathon.name,
                    website: hackathon.website,
                    organizer: hackathon.organizer
                });
            });

            this.lastCacheUpdate = now;
            console.log(`📦 Updated deduplication cache with ${this.existingHackathons.size} existing hackathons`);

        } catch (error) {
            console.error('Error updating hackathon cache:', error);
        }
    }

    /**
     * Generate a unique key for deduplication
     */
    generateDeduplicationKey(hackathon) {
        const name = (hackathon.name || hackathon.title || '').toLowerCase().trim();
        const organizer = (hackathon.organizer?.name || hackathon.organizer || '').toLowerCase().trim();
        const website = (hackathon.website || '').toLowerCase().replace(/https?:\/\//, '').replace(/www\./, '');

        // Create a unique key combining name, organizer, and website
        return `${name}|${organizer}|${website}`;
    }

    /**
     * Check if hackathon already exists in database
     */
    isDuplicate(hackathon) {
        const key = this.generateDeduplicationKey(hackathon);
        return this.existingHackathons.has(key);
    }

    /**
     * Filter out duplicate hackathons
     */
    removeDuplicates(hackathons) {
        const filtered = [];
        const processedKeys = new Set();

        for (const hackathon of hackathons) {
            const key = this.generateDeduplicationKey(hackathon);

            // Skip if already exists in database
            if (this.existingHackathons.has(key)) {
                console.log(`🔄 Skipping duplicate: ${hackathon.title || hackathon.name}`);
                continue;
            }

            // Skip if already processed in this batch
            if (processedKeys.has(key)) {
                console.log(`🔄 Skipping batch duplicate: ${hackathon.title || hackathon.name}`);
                continue;
            }

            processedKeys.add(key);
            filtered.push(hackathon);
        }

        return filtered;
    }

    /**
     * Save hackathons to database with deduplication
     */
    async saveHackathonsToDatabase(hackathonData, skipDuplicates = true) {
        try {
            // Update cache first
            await this.updateExistingHackathonsCache();

            // Convert to database format
            const dbFormatHackathons = this.mapToDbFormat(hackathonData);

            // Filter duplicates if requested
            const hackathonsToSave = skipDuplicates ?
                this.removeDuplicates(dbFormatHackathons) :
                dbFormatHackathons;

            if (hackathonsToSave.length === 0) {
                return {
                    success: true,
                    saved: 0,
                    skipped: dbFormatHackathons.length,
                    message: 'All hackathons were duplicates, none saved'
                };
            }

            // Save to database
            const savedHackathons = await Hackathon.insertMany(hackathonsToSave);

            // Update cache with newly saved hackathons
            savedHackathons.forEach(hackathon => {
                const key = this.generateDeduplicationKey(hackathon);
                this.existingHackathons.set(key, {
                    id: hackathon._id,
                    name: hackathon.name,
                    website: hackathon.website,
                    organizer: hackathon.organizer
                });
            });

            console.log(`✅ Saved ${savedHackathons.length} new hackathons to database`);
            console.log(`🔄 Skipped ${dbFormatHackathons.length - hackathonsToSave.length} duplicates`);

            return {
                success: true,
                saved: savedHackathons.length,
                skipped: dbFormatHackathons.length - hackathonsToSave.length,
                savedIds: savedHackathons.map(h => h._id),
                message: `Successfully saved ${savedHackathons.length} hackathons`
            };

        } catch (error) {
            console.error('Error saving hackathons to database:', error);
            return {
                success: false,
                error: error.message,
                saved: 0,
                skipped: 0
            };
        }
    }
}

module.exports = ModernGeminiService;
