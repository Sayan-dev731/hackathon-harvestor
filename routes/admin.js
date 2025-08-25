const express = require('express');
const WebsiteConfig = require('../models/websiteConfig');
const Hackathon = require('../models/hackathon');
const ModernGeminiService = require('../services/modernGeminiService');
const router = express.Router();

// Initialize services
const geminiService = new ModernGeminiService();

// Get all website configurations
router.get('/websites', async (req, res) => {
    try {
        const websites = await WebsiteConfig.find().sort({ createdAt: -1 });
        res.json(websites);
    } catch (error) {
        console.error('Error fetching websites:', error);
        res.status(500).json({ error: 'Failed to fetch websites' });
    }
});

// Add new website configuration
router.post('/websites', async (req, res) => {
    try {
        const { name, url, startDate, endDate, notes } = req.body;

        // Validate required fields
        if (!name || !url || !startDate || !endDate) {
            return res.status(400).json({
                error: 'Name, URL, start date, and end date are required'
            });
        }

        // Check if URL already exists
        const existingWebsite = await WebsiteConfig.findOne({ url });
        if (existingWebsite) {
            return res.status(400).json({ error: 'Website URL already exists' });
        }

        const website = new WebsiteConfig({
            name,
            url,
            startDate: new Date(startDate),
            endDate: new Date(endDate),
            notes: notes || ''
        });

        await website.save();
        res.status(201).json(website);
    } catch (error) {
        console.error('Error creating website:', error);
        res.status(500).json({ error: 'Failed to create website configuration' });
    }
});

// Update website configuration
router.put('/websites/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        const website = await WebsiteConfig.findByIdAndUpdate(
            id,
            updates,
            { new: true, runValidators: true }
        );

        if (!website) {
            return res.status(404).json({ error: 'Website not found' });
        }

        res.json(website);
    } catch (error) {
        console.error('Error updating website:', error);
        res.status(500).json({ error: 'Failed to update website configuration' });
    }
});

// Delete website configuration
router.delete('/websites/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const website = await WebsiteConfig.findByIdAndDelete(id);

        if (!website) {
            return res.status(404).json({ error: 'Website not found' });
        }

        res.json({ message: 'Website configuration deleted successfully' });
    } catch (error) {
        console.error('Error deleting website:', error);
        res.status(500).json({ error: 'Failed to delete website configuration' });
    }
});

// Trigger AI search for hackathons
router.post('/search/:category', async (req, res) => {
    try {
        const { category } = req.params;
        const { query } = req.body;

        let searchResult;
        if (category === 'custom' && query) {
            searchResult = await geminiService.searchHackathons(query);
        } else {
            searchResult = await geminiService.searchByCategory(category);
        }

        if (searchResult.success) {
            res.json({
                message: `Found ${searchResult.data.hackathons.length} hackathons`,
                data: searchResult.data
            });
        } else {
            res.status(400).json({ error: searchResult.error });
        }
    } catch (error) {
        console.error('Error in AI search:', error);
        res.status(500).json({ error: 'Failed to search hackathons' });
    }
});

// Trigger search for all popular categories
router.post('/search-all-categories', async (req, res) => {
    try {
        const categories = ['ai-ml', 'blockchain', 'fintech', 'student', 'startup'];
        const results = [];

        for (const category of categories) {
            try {
                const result = await geminiService.searchByCategory(category);
                if (result.success) {
                    results.push({
                        category,
                        count: result.data.hackathons.length,
                        success: true
                    });
                }
            } catch (error) {
                results.push({
                    category,
                    error: error.message,
                    success: false
                });
            }
        }

        res.json({
            message: 'AI search completed for all categories',
            results
        });
    } catch (error) {
        console.error('Error in batch AI search:', error);
        res.status(500).json({ error: 'Failed to search all categories' });
    }
});

// Get AI search status and API usage
router.get('/search-status', async (req, res) => {
    try {
        console.log('Search status endpoint called');
        // For now, just return a simple status since we don't have the same tracking as scraping
        const status = {
            isRunning: false,
            lastRun: new Date(),
            totalSearches: 0,
            errors: []
        };

        console.log('AI search status:', status);
        // Note: Modern service doesn't track API requests the same way
        const remainingRequests = 1000; // Default for demonstration
        console.log('Estimated remaining requests:', remainingRequests);

        const response = {
            ...status,
            remainingApiRequests: remainingRequests,
            note: "Using modern AI-powered search instead of traditional scraping"
        };
        console.log('Sending search status response:', response);

        res.json(response);
    } catch (error) {
        console.error('Error getting search status:', error);
        res.status(500).json({ error: 'Failed to get scraping status', details: error.message });
    }
});

// Test Gemini service with a specific URL
router.post('/test-gemini', async (req, res) => {
    try {
        const { url } = req.body;

        if (!url) {
            return res.status(400).json({ error: 'URL is required' });
        }

        console.log(`Testing Gemini service with URL: ${url}`);

        // Get services with error handling
        let services;
        try {
            services = getServices();
        } catch (serviceError) {
            return res.status(500).json({
                error: 'Service initialization failed',
                details: serviceError.message,
                troubleshooting: [
                    'Check that GEMINI_API_KEY or API_KEY environment variable is set',
                    'Verify the API key is valid'
                ]
            });
        }

        const { geminiService } = services;

        // Test the Gemini service directly
        const result = await geminiService.extractHackathonData(url);

        res.json({
            success: true,
            result: result,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Error testing Gemini service:', error);
        res.status(500).json({
            error: 'Failed to test Gemini service',
            details: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// Extract and save hackathon data directly from URL
router.post('/extract-and-save', async (req, res) => {
    try {
        const { url } = req.body;

        if (!url) {
            return res.status(400).json({ error: 'URL is required' });
        }

        console.log(`Extracting and saving hackathon data from URL: ${url}`);

        // Get services with error handling
        let services;
        try {
            services = getServices();
        } catch (serviceError) {
            return res.status(500).json({
                error: 'Service initialization failed',
                details: serviceError.message,
                troubleshooting: [
                    'Check that GEMINI_API_KEY or API_KEY environment variable is set',
                    'Verify the API key is valid'
                ]
            });
        }

        const { geminiService } = services;

        // Extract hackathon data using Gemini
        const result = await geminiService.extractHackathonData(url);

        if (!result.success || !result.data || !result.data.hackathons || result.data.hackathons.length === 0) {
            return res.status(400).json({
                error: 'No valid hackathon data found at the provided URL',
                details: result.error || 'No hackathons extracted'
            });
        }

        const Hackathon = require('../models/hackathon');
        const savedHackathons = [];
        const skippedHackathons = [];

        // Process each hackathon found
        for (const hackathonData of result.data.hackathons) {
            try {
                // Validate the hackathon data
                if (!geminiService.validateHackathonData(hackathonData)) {
                    console.log('Invalid hackathon data, skipping...');
                    skippedHackathons.push({
                        title: hackathonData.title || 'Unknown',
                        reason: 'Failed validation'
                    });
                    continue;
                }

                // Map extracted data to database schema
                const mappedData = geminiService.mapToDbSchema(hackathonData, url);

                // Check if hackathon already exists (by name and website URL)
                const urlDomain = url.replace(/https?:\/\//, '').split('/')[0];
                let existingHackathon = await Hackathon.findOne({
                    name: mappedData.name,
                    website: { $regex: new RegExp(urlDomain, 'i') }
                });

                if (existingHackathon) {
                    // Update existing hackathon
                    Object.assign(existingHackathon, {
                        ...mappedData,
                        extractedAt: existingHackathon.extractedAt // Keep original extraction date
                    });
                    await existingHackathon.save();
                    savedHackathons.push({
                        name: mappedData.name,
                        action: 'updated',
                        id: existingHackathon._id
                    });
                    console.log(`Updated hackathon: ${mappedData.name}`);
                } else {
                    // Create new hackathon
                    const newHackathon = new Hackathon(mappedData);
                    await newHackathon.save();
                    savedHackathons.push({
                        name: mappedData.name,
                        action: 'created',
                        id: newHackathon._id
                    });
                    console.log(`Created new hackathon: ${mappedData.name}`);
                }
            } catch (hackathonError) {
                console.error(`Error processing hackathon:`, hackathonError.message);
                skippedHackathons.push({
                    title: hackathonData.title || 'Unknown',
                    reason: hackathonError.message
                });
                continue;
            }
        }

        res.json({
            success: true,
            message: `Successfully processed ${savedHackathons.length} hackathons`,
            data: {
                saved: savedHackathons,
                skipped: skippedHackathons,
                totalFound: result.data.hackathons.length,
                confidence: result.data.confidence
            },
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Error extracting and saving hackathon data:', error);
        res.status(500).json({
            error: 'Failed to extract and save hackathon data',
            details: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// ==================== HACKATHON CRUD OPERATIONS ====================

// Get all hackathons with pagination and search
router.get('/hackathons', async (req, res) => {
    try {
        const {
            page = 1,
            limit = 50, // No limit restriction 
            search = '',
            status = '',
            sortBy = 'startDate',
            sortOrder = 'asc'
        } = req.query;

        const query = {};

        // Add search filter
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } },
                { organizer: { $regex: search, $options: 'i' } },
                { themes: { $in: [new RegExp(search, 'i')] } }
            ];
        }

        // Add status filter
        if (status) {
            query.status = status;
        }

        const sort = {};
        sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

        const hackathons = await Hackathon.find(query)
            .sort(sort)
            .limit(parseInt(limit))
            .skip((parseInt(page) - 1) * parseInt(limit));

        const total = await Hackathon.countDocuments(query);

        res.json({
            success: true,
            data: hackathons,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(total / parseInt(limit)),
                totalItems: total,
                itemsPerPage: parseInt(limit)
            }
        });
    } catch (error) {
        console.error('Error fetching hackathons:', error);
        res.status(500).json({ error: 'Failed to fetch hackathons' });
    }
});

// Get single hackathon by ID
router.get('/hackathons/:id', async (req, res) => {
    try {
        const hackathon = await Hackathon.findById(req.params.id);

        if (!hackathon) {
            return res.status(404).json({ error: 'Hackathon not found' });
        }

        res.json({ success: true, data: hackathon });
    } catch (error) {
        console.error('Error fetching hackathon:', error);
        res.status(500).json({ error: 'Failed to fetch hackathon' });
    }
});

// Create new hackathon
router.post('/hackathons', async (req, res) => {
    try {
        const hackathonData = req.body;

        // Validate required fields
        if (!hackathonData.name || !hackathonData.website || !hackathonData.startDate) {
            return res.status(400).json({
                error: 'Name, website, and start date are required'
            });
        }

        // Check if website already exists
        const existingHackathon = await Hackathon.findOne({ website: hackathonData.website });
        if (existingHackathon) {
            return res.status(400).json({ error: 'Hackathon with this website already exists' });
        }

        const hackathon = new Hackathon(hackathonData);
        await hackathon.save();

        res.status(201).json({
            success: true,
            data: hackathon,
            message: 'Hackathon created successfully'
        });
    } catch (error) {
        console.error('Error creating hackathon:', error);
        res.status(500).json({ error: 'Failed to create hackathon' });
    }
});

// Update hackathon
router.put('/hackathons/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        // If website is being updated, check for duplicates
        if (updates.website) {
            const existingHackathon = await Hackathon.findOne({
                website: updates.website,
                _id: { $ne: id }
            });
            if (existingHackathon) {
                return res.status(400).json({ error: 'Hackathon with this website already exists' });
            }
        }

        const hackathon = await Hackathon.findByIdAndUpdate(
            id,
            { ...updates, lastUpdated: new Date() },
            { new: true, runValidators: true }
        );

        if (!hackathon) {
            return res.status(404).json({ error: 'Hackathon not found' });
        }

        res.json({
            success: true,
            data: hackathon,
            message: 'Hackathon updated successfully'
        });
    } catch (error) {
        console.error('Error updating hackathon:', error);
        res.status(500).json({ error: 'Failed to update hackathon' });
    }
});

// Delete hackathon
router.delete('/hackathons/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const hackathon = await Hackathon.findByIdAndDelete(id);

        if (!hackathon) {
            return res.status(404).json({ error: 'Hackathon not found' });
        }

        res.json({
            success: true,
            message: 'Hackathon deleted successfully',
            data: { deletedId: id }
        });
    } catch (error) {
        console.error('Error deleting hackathon:', error);
        res.status(500).json({ error: 'Failed to delete hackathon' });
    }
});

// ==================== API USAGE AND SCHEDULING ====================

// Get API usage statistics
router.get('/api-usage', async (req, res) => {
    try {
        const ApiUsage = require('../models/apiUsage');
        const usage = await ApiUsage.getTodaysUsage();

        res.json({
            success: true,
            data: {
                currentUsage: usage.geminiApiCalls,
                dailyLimit: usage.dailyLimit,
                remaining: Math.max(0, usage.dailyLimit - usage.geminiApiCalls),
                canMakeRequest: !usage.isLimitReached(),
                resetTime: new Date(Date.now() + (24 * 60 * 60 * 1000)).toISOString(),
                autoFetchRuns: usage.autoFetchRuns,
                lastAutoFetch: usage.lastAutoFetch
            }
        });
    } catch (error) {
        console.error('Error fetching API usage:', error);
        res.status(500).json({ error: 'Failed to fetch API usage statistics' });
    }
});

// Trigger manual auto-fetch
router.post('/trigger-auto-fetch', async (req, res) => {
    try {
        const AutoFetchScheduler = require('../services/autoFetchScheduler');
        const scheduler = new AutoFetchScheduler();

        // Run auto-fetch in background
        scheduler.triggerManualFetch().then(() => {
            console.log('Manual auto-fetch completed');
        }).catch(error => {
            console.error('Manual auto-fetch failed:', error);
        });

        res.json({
            success: true,
            message: 'Auto-fetch triggered successfully. Check back in a few minutes for results.'
        });
    } catch (error) {
        console.error('Error triggering auto-fetch:', error);
        res.status(500).json({ error: 'Failed to trigger auto-fetch' });
    }
});

module.exports = router;
