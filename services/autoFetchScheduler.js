const cron = require('node-cron');
const WebsiteConfig = require('../models/websiteConfig');
const Hackathon = require('../models/hackathon');
const ApiUsage = require('../models/apiUsage');
const ModernGeminiService = require('./modernGeminiService');

/**
 * Auto Fetch Scheduler Service
 * Automatically fetches hackathon details every 6 hours
 */
class AutoFetchScheduler {
    constructor() {
        this.geminiService = new ModernGeminiService();
        this.isRunning = false;
        this.lastRun = null;
    }

    /**
     * Start the auto-fetch scheduler
     */
    start() {
        console.log('🤖 Auto-fetch scheduler starting...');

        // Run every 6 hours: 0 */6 * * *
        this.job = cron.schedule('0 */6 * * *', async () => {
            await this.performAutoFetch();
        }, {
            scheduled: true,
            timezone: "UTC"
        });

        console.log('✅ Auto-fetch scheduler started - will run every 6 hours');

        // Also run immediately on startup if needed
        setTimeout(() => this.performAutoFetch(), 5000); // Wait 5 seconds after startup
    }

    /**
     * Stop the auto-fetch scheduler
     */
    stop() {
        if (this.job) {
            this.job.stop();
            console.log('🛑 Auto-fetch scheduler stopped');
        }
    }

    /**
     * Perform automatic fetch of hackathon details
     */
    async performAutoFetch() {
        if (this.isRunning) {
            console.log('⏳ Auto-fetch already running, skipping...');
            return;
        }

        this.isRunning = true;
        console.log('🚀 Starting automatic hackathon fetch...');

        try {
            // Check API usage limit
            const apiUsage = await ApiUsage.getTodaysUsage();
            if (apiUsage.isLimitReached()) {
                console.log('❌ Auto-fetch skipped - daily API limit reached');
                return;
            }

            // Get all active website configurations
            const activeWebsites = await WebsiteConfig.find({
                isActive: { $ne: false },
                endDate: { $gte: new Date() } // Only websites with future end dates
            });

            if (activeWebsites.length === 0) {
                console.log('📝 No active websites found for auto-fetch');
                return;
            }

            console.log(`🎯 Found ${activeWebsites.length} active websites to fetch from`);

            let totalFetched = 0;
            let totalSaved = 0;

            for (const website of activeWebsites) {
                try {
                    // Check if we've hit the API limit
                    const currentUsage = await ApiUsage.getTodaysUsage();
                    if (currentUsage.isLimitReached()) {
                        console.log('❌ API limit reached during auto-fetch, stopping...');
                        break;
                    }

                    console.log(`🔍 Auto-fetching from: ${website.name} (${website.url})`);

                    // Create a targeted search query based on website and date range
                    const searchQuery = `hackathon competition "${website.name}" site:${website.url.replace(/https?:\/\//, '')}`;
                    const adminPrompt = `Find hackathon details specifically from ${website.url} between ${website.startDate.toISOString().split('T')[0]} and ${website.endDate.toISOString().split('T')[0]}`;

                    // Perform search
                    const searchResult = await this.geminiService.adminSearch(searchQuery, adminPrompt, 3);

                    if (searchResult.success && searchResult.data.hackathons.length > 0) {
                        totalFetched += searchResult.data.hackathons.length;

                        // Save hackathons to database
                        const saveResult = await this.geminiService.saveHackathonsToDatabase(searchResult.data, true);

                        if (saveResult.success) {
                            totalSaved += saveResult.saved;
                            console.log(`✅ Auto-fetch from ${website.name}: ${saveResult.saved} hackathons saved`);
                        }

                        // Update API usage
                        await currentUsage.incrementUsage();
                    } else {
                        console.log(`📝 No hackathons found for ${website.name}`);
                    }

                    // Update website's last fetch time
                    website.lastFetched = new Date();
                    await website.save();

                    // Small delay between requests to be respectful
                    await new Promise(resolve => setTimeout(resolve, 2000));

                } catch (websiteError) {
                    console.error(`❌ Error fetching from ${website.name}:`, websiteError.message);
                }
            }

            // Update auto-fetch statistics
            apiUsage.autoFetchRuns += 1;
            apiUsage.lastAutoFetch = new Date();
            await apiUsage.save();

            this.lastRun = new Date();
            console.log(`🎉 Auto-fetch completed: ${totalFetched} hackathons found, ${totalSaved} saved`);

        } catch (error) {
            console.error('❌ Auto-fetch error:', error);
        } finally {
            this.isRunning = false;
        }
    }

    /**
     * Get auto-fetch status
     */
    getStatus() {
        return {
            isRunning: this.isRunning,
            lastRun: this.lastRun,
            nextRun: this.job ? this.job.nextDate() : null,
            isScheduled: this.job ? this.job.scheduled : false
        };
    }

    /**
     * Manually trigger auto-fetch (for testing)
     */
    async triggerManualFetch() {
        console.log('🔧 Manual auto-fetch triggered');
        await this.performAutoFetch();
    }
}

module.exports = AutoFetchScheduler;
