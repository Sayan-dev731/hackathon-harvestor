const express = require('express');
const WebsiteConfig = require('../models/websiteConfig');
const ScrapingService = require('../services/scrapingService');
const GeminiService = require('../services/geminiService');
const router = express.Router();

// Initialize services
const scrapingService = new ScrapingService();
const geminiService = new GeminiService();

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

// Manual scrape single website
router.post('/scrape/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await scrapingService.manualScrape(id);

        if (result.success) {
            res.json({ message: result.message });
        } else {
            res.status(400).json({ error: result.message });
        }
    } catch (error) {
        console.error('Error manual scraping:', error);
        res.status(500).json({ error: 'Failed to scrape website' });
    }
});

// Trigger scraping for all websites
router.post('/scrape-all', async (req, res) => {
    try {
        // Don't wait for completion, run in background
        scrapingService.scrapeAllWebsites();
        res.json({ message: 'Scraping started for all websites' });
    } catch (error) {
        console.error('Error starting scrape all:', error);
        res.status(500).json({ error: 'Failed to start scraping' });
    }
});

// Get scraping status
router.get('/scraping-status', async (req, res) => {
    try {
        console.log('Scraping status endpoint called');
        const status = scrapingService.getScrapingStatus();
        console.log('Got scraping status:', status);
        const remainingRequests = await geminiService.getRemainingRequests();
        console.log('Got remaining requests for status:', remainingRequests);

        const response = {
            ...status,
            remainingApiRequests: remainingRequests
        };
        console.log('Sending scraping status response:', response);

        res.json(response);
    } catch (error) {
        console.error('Error getting scraping status:', error);
        res.status(500).json({ error: 'Failed to get scraping status', details: error.message });
    }
});

// Get API usage statistics
router.get('/api-usage', async (req, res) => {
    try {
        console.log('API usage endpoint called');
        const remainingRequests = await geminiService.getRemainingRequests();
        console.log('Got remaining requests:', remainingRequests);
        const dailyLimit = parseInt(process.env.DAILY_REQUEST_LIMIT) || 1000;
        const usedRequests = dailyLimit - remainingRequests;

        const response = {
            dailyLimit,
            usedRequests,
            remainingRequests,
            usagePercentage: Math.round((usedRequests / dailyLimit) * 100)
        };
        console.log('Sending response:', response);

        res.json(response);
    } catch (error) {
        console.error('Error getting API usage:', error);
        res.status(500).json({ error: 'Failed to get API usage statistics', details: error.message });
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

module.exports = router;
