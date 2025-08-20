const cron = require('node-cron');
const WebsiteConfig = require('../models/websiteConfig');
const Hackathon = require('../models/hackathon');
const GeminiService = require('./geminiService');

class ScrapingService {
    constructor() {
        this.isRunning = false;
        this.geminiService = new GeminiService();
    }

    startScheduledScraping() {
        // Run every day at 6 AM
        cron.schedule('0 6 * * *', async () => {
            console.log('Starting scheduled scraping...');
            await this.scrapeAllWebsites();
        });

        // Run every 6 hours during the day
        cron.schedule('0 */6 * * *', async () => {
            console.log('Starting periodic scraping...');
            await this.scrapeAllWebsites();
        });

        console.log('Scheduled scraping initialized');
    }

    async scrapeAllWebsites() {
        if (this.isRunning) {
            console.log('Scraping already in progress...');
            return;
        }

        this.isRunning = true;

        try {
            const websites = await WebsiteConfig.find({ isActive: true });
            console.log(`Found ${websites.length} websites to scrape`);

            for (const website of websites) {
                try {
                    await this.scrapeWebsite(website);
                    // Add delay between requests to avoid rate limiting
                    await new Promise(resolve => setTimeout(resolve, 2000));
                } catch (error) {
                    console.error(`Error scraping ${website.name}:`, error.message);
                }
            }

            console.log('Completed scraping all websites');
        } catch (error) {
            console.error('Error in scrapeAllWebsites:', error);
        } finally {
            this.isRunning = false;
        }
    }

    async scrapeWebsite(websiteConfig) {
        try {
            console.log(`Scraping ${websiteConfig.name}...`);

            // Use Gemini to extract hackathon information directly from URL
            const result = await this.geminiService.extractHackathonData(websiteConfig.url);

            if (!result.success || !result.data || !result.data.hackathons || result.data.hackathons.length === 0) {
                console.log(`No valid hackathon data found for ${websiteConfig.name}`);
                return;
            }

            // Process each hackathon found
            for (const hackathonData of result.data.hackathons) {
                try {
                    // Validate the hackathon data
                    if (!this.geminiService.validateHackathonData(hackathonData)) {
                        console.log('Invalid hackathon data, skipping...');
                        continue;
                    }

                    // Map extracted data to database schema
                    const mappedData = this.geminiService.mapToDbSchema(hackathonData, websiteConfig.url);

                    // Check if hackathon already exists (by name and website domain)
                    const websiteDomain = websiteConfig.url.replace(/https?:\/\//, '').split('/')[0];
                    let existingHackathon = await Hackathon.findOne({
                        name: mappedData.name,
                        website: { $regex: new RegExp(websiteDomain, 'i') }
                    });

                    if (existingHackathon) {
                        // Update existing hackathon
                        Object.assign(existingHackathon, {
                            ...mappedData,
                            extractedAt: existingHackathon.extractedAt // Keep original extraction date
                        });
                        await existingHackathon.save();
                        console.log(`Updated hackathon: ${mappedData.name}`);
                    } else {
                        // Create new hackathon
                        const newHackathon = new Hackathon(mappedData);
                        await newHackathon.save();
                        console.log(`Created new hackathon: ${mappedData.name}`);
                    }
                } catch (hackathonError) {
                    console.error(`Error processing hackathon:`, hackathonError.message);
                    continue;
                }
            }

            // Update website config
            websiteConfig.lastScraped = new Date();
            await websiteConfig.save();

        } catch (error) {
            if (error.message.includes('Daily API limit reached')) {
                console.log('Daily API limit reached. Stopping scraping for today.');
                throw error;
            }
            console.error(`Error scraping ${websiteConfig.name}:`, error);
        }
    }

    async manualScrape(websiteId) {
        try {
            const website = await WebsiteConfig.findById(websiteId);
            if (!website) {
                throw new Error('Website not found');
            }

            await this.scrapeWebsite(website);
            return { success: true, message: `Successfully scraped ${website.name}` };
        } catch (error) {
            return { success: false, message: error.message };
        }
    }

    getScrapingStatus() {
        return {
            isRunning: this.isRunning,
            lastRun: new Date()
        };
    }
}

module.exports = ScrapingService;
