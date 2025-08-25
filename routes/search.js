const express = require('express');
const ModernGeminiService = require('../services/modernGeminiService');
const JsonFormatterService = require('../services/jsonFormatterService');
const Hackathon = require('../models/hackathon');
const { authenticateAdminQuery } = require('../middleware/auth');
const router = express.Router();

// Initialize services
const geminiService = new ModernGeminiService();
const jsonFormatter = new JsonFormatterService();

/**
 * POST /api/search/admin
 * Admin-only search with custom prompts and Gemini 2.5 Flash processing
 * Requires authentication: admin_id and admin_password in query params
 */
router.post('/admin', authenticateAdminQuery, async (req, res) => {
    try {
        const {
            query = "upcoming hackathons 2024 2025",
            prompt,
            limit = 5,
            save = false
        } = req.body;

        console.log(`🔥 Admin search request from ${req.admin.id}: query="${query}", limit=${limit}`);

        if (!prompt) {
            return res.status(400).json({
                error: 'Admin prompt required',
                message: 'Please provide a specific prompt describing what you want to search for'
            });
        }

        // Step 1: Perform admin search with ModernGeminiService (search only)
        const searchResult = await geminiService.adminSearch(query, prompt, parseInt(limit));

        if (!searchResult.success) {
            return res.status(500).json({
                error: 'Admin search failed',
                message: searchResult.error,
                timestamp: searchResult.timestamp
            });
        }

        // Step 2: Format the search results with JsonFormatterService
        const formattingOptions = {
            includeMetadata: true,
            strictValidation: false
        };

        const formatResult = await jsonFormatter.formatToJson(
            searchResult.data,
            prompt,
            formattingOptions
        );

        if (!formatResult.success) {
            console.warn('JSON formatting failed, using raw search results');
            // Use raw data if formatting fails
            formatResult.data = searchResult.data;
            formatResult.success = true;
        }

        // Combine results
        const finalResult = {
            success: true,
            data: formatResult.data,
            metadata: {
                ...searchResult.metadata,
                ...formatResult.metadata,
                processedBy: ["ModernGeminiService", "JsonFormatterService"]
            },
            timestamp: new Date().toISOString()
        };

        // Optionally save to database with deduplication
        if (save === true && finalResult.data.hackathons && finalResult.data.hackathons.length > 0) {
            try {
                console.log(`💾 Admin requested to save ${finalResult.data.hackathons.length} hackathons`);

                // Use the new saveHackathonsToDatabase method with deduplication
                const saveResult = await geminiService.saveHackathonsToDatabase(finalResult.data, true);

                if (saveResult.success) {
                    console.log(`✅ Saved ${saveResult.saved} new hackathons, skipped ${saveResult.skipped} duplicates`);
                    finalResult.saved = {
                        count: saveResult.saved,
                        skipped: saveResult.skipped,
                        total: finalResult.data.hackathons.length,
                        savedBy: req.admin.id,
                        message: saveResult.message
                    };
                } else {
                    console.error('Error in bulk save:', saveResult.error);
                    finalResult.saveError = saveResult.error;
                }
            } catch (saveError) {
                console.error('Error saving to database:', saveError);
                finalResult.saveError = saveError.message;
            }
        }

        res.json({
            success: true,
            admin: req.admin.id,
            query: query,
            prompt: prompt,
            limit: limit,
            ...finalResult
        });
    } catch (error) {
        console.error('❌ Error in admin search:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * GET /api/search/hackathons
 * RESTRICTED: Admin-only search for hackathons using Google Search + Gemini AI
 * Regular users should use /api/hackathons to get stored data
 */
router.get('/hackathons', authenticateAdminQuery, async (req, res) => {
    try {
        const {
            query = "upcoming hackathons 2024 2025",
            category,
            location,
            limit = 10,
            save = false
        } = req.query;

        console.log(`🔍 Admin search request: query="${query}", category="${category}", location="${location}", limit=${limit}`);

        let searchResult;

        // Determine search type
        const searchLimit = parseInt(limit) || 10;
        if (category) {
            searchResult = await geminiService.searchByCategory(category, searchLimit);
        } else if (location) {
            searchResult = await geminiService.searchByLocation(location, searchLimit);
        } else {
            searchResult = await geminiService.searchHackathons(query, searchLimit);
        }

        if (!searchResult.success) {
            return res.status(500).json({
                error: 'Search failed',
                message: searchResult.error,
                timestamp: searchResult.timestamp
            });
        }

        // Optionally save to database with deduplication
        if (save === 'true' && searchResult.data.hackathons.length > 0) {
            try {
                console.log(`💾 Admin requested to save ${searchResult.data.hackathons.length} hackathons`);

                // Use the new saveHackathonsToDatabase method with deduplication
                const saveResult = await geminiService.saveHackathonsToDatabase(searchResult.data, true);

                if (saveResult.success) {
                    console.log(`✅ Saved ${saveResult.saved} new hackathons, skipped ${saveResult.skipped} duplicates`);
                    searchResult.saved = {
                        count: saveResult.saved,
                        skipped: saveResult.skipped,
                        total: searchResult.data.hackathons.length,
                        searchedBy: req.admin.id,
                        searchQuery: query,
                        message: saveResult.message
                    };
                } else {
                    console.error('Error in bulk save:', saveResult.error);
                    searchResult.saveError = saveResult.error;
                }
            } catch (saveError) {
                console.error('Error saving to database:', saveError);
                searchResult.saveError = saveError.message;
            }
        }

        res.json({
            success: true,
            admin: req.admin.id,
            query: query,
            category: category,
            location: location,
            limit: searchLimit,
            ...searchResult
        });

    } catch (error) {
        console.error('❌ Error in hackathon search:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * GET /api/search/categories
 * Get available search categories (public endpoint)
 */
router.get('/categories', (req, res) => {
    const categories = [
        { id: 'ai-ml', name: 'AI & Machine Learning', description: 'Artificial intelligence and ML hackathons' },
        { id: 'blockchain', name: 'Blockchain & Web3', description: 'Cryptocurrency, DeFi, and blockchain events' },
        { id: 'fintech', name: 'FinTech', description: 'Financial technology and payments' },
        { id: 'healthtech', name: 'HealthTech', description: 'Medical and healthcare technology' },
        { id: 'climate', name: 'Climate & Sustainability', description: 'Environmental and green technology' },
        { id: 'student', name: 'Student Hackathons', description: 'University and college events' },
        { id: 'startup', name: 'Startup & Entrepreneurship', description: 'Business and innovation challenges' },
        { id: 'gaming', name: 'Gaming & VR/AR', description: 'Game development and immersive tech' },
        { id: 'iot', name: 'IoT & Hardware', description: 'Internet of Things and embedded systems' },
        { id: 'cybersecurity', name: 'Cybersecurity', description: 'Security and privacy focused events' }
    ];

    res.json({
        success: true,
        categories,
        total: categories.length,
        note: "Search functionality requires admin authentication. Regular users can view stored hackathons at /api/hackathons"
    });
});

/**
 * GET /api/search/trends
 * Analyze hackathon trends from recent searches (admin-only)
 */
router.get('/trends', authenticateAdminQuery, async (req, res) => {
    try {
        // Get recent hackathons from database
        const recentHackathons = await Hackathon.find({
            extractedAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } // Last 30 days
        }).limit(100).lean();

        if (recentHackathons.length === 0) {
            return res.json({
                success: true,
                message: 'No recent hackathon data available for trend analysis',
                trends: null
            });
        }

        // Analyze trends using Gemini
        const analysis = await geminiService.analyzeHackathonTrends(recentHackathons);

        res.json({
            success: true,
            admin: req.admin.id,
            dataPoints: recentHackathons.length,
            periodDays: 30,
            ...analysis
        });

    } catch (error) {
        console.error('Error analyzing trends:', error);
        res.status(500).json({
            error: 'Failed to analyze trends',
            message: error.message
        });
    }
});

/**
 * POST /api/search/custom
 * Custom search with specific parameters
 */
router.post('/custom', async (req, res) => {
    try {
        const {
            searchQuery,
            filters = {},
            save = false,
            maxResults = 20
        } = req.body;

        if (!searchQuery || searchQuery.trim().length === 0) {
            return res.status(400).json({
                error: 'Search query is required',
                message: 'Please provide a searchQuery in the request body'
            });
        }

        console.log(`🎯 Custom search: "${searchQuery}" with filters:`, filters);

        // Build enhanced search query with filters
        let enhancedQuery = searchQuery;

        if (filters.year) {
            enhancedQuery += ` ${filters.year}`;
        }
        if (filters.technology) {
            enhancedQuery += ` ${filters.technology}`;
        }
        if (filters.format) {
            enhancedQuery += ` ${filters.format}`;
        }

        const searchResult = await geminiService.searchHackathons(enhancedQuery);

        if (!searchResult.success) {
            return res.status(500).json({
                error: 'Custom search failed',
                message: searchResult.error
            });
        }

        // Apply post-search filtering if needed
        let filteredHackathons = searchResult.data.hackathons;

        if (filters.minPrize) {
            filteredHackathons = filteredHackathons.filter(h => {
                const prizeText = h.prizes.totalPool.toLowerCase();
                return prizeText.includes('$') && parseInt(prizeText.replace(/[^0-9]/g, '')) >= filters.minPrize;
            });
        }

        if (filters.status) {
            filteredHackathons = filteredHackathons.filter(h => h.status === filters.status);
        }

        // Limit results
        filteredHackathons = filteredHackathons.slice(0, maxResults);

        // Update the result
        searchResult.data.hackathons = filteredHackathons;
        searchResult.data.metadata.totalFound = filteredHackathons.length;
        searchResult.data.metadata.filtered = true;
        searchResult.data.metadata.appliedFilters = filters;

        // Save if requested with deduplication
        if (save && filteredHackathons.length > 0) {
            try {
                console.log(`💾 Custom search requested to save ${filteredHackathons.length} hackathons`);

                // Use the new saveHackathonsToDatabase method with deduplication
                const saveResult = await geminiService.saveHackathonsToDatabase(
                    { hackathons: filteredHackathons },
                    true
                );

                if (saveResult.success) {
                    console.log(`✅ Saved ${saveResult.saved} new hackathons, skipped ${saveResult.skipped} duplicates`);
                    searchResult.saved = {
                        count: saveResult.saved,
                        skipped: saveResult.skipped,
                        total: filteredHackathons.length,
                        message: saveResult.message
                    };
                } else {
                    console.error('Error in bulk save:', saveResult.error);
                    searchResult.saveError = saveResult.error;
                }
            } catch (saveError) {
                console.error('Error saving to database:', saveError);
                searchResult.saveError = saveError.message;
            }
        }

        res.json({
            success: true,
            originalQuery: searchQuery,
            enhancedQuery,
            filters,
            ...searchResult
        });

    } catch (error) {
        console.error('Error in custom search:', error);
        res.status(500).json({
            error: 'Custom search failed',
            message: error.message
        });
    }
});

module.exports = router;
