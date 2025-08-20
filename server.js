require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

// Import routes
const hackathonsRoutes = require('./routes/hackathons');
const adminRoutes = require('./routes/admin');

// Import services
const ScrapingService = require('./services/scrapingService');
const GeminiService = require('./services/geminiService');

// Initialize services only if environment is properly configured
let scrapingService = null;
let geminiService = null;

function initializeServices() {
    try {
        if (!scrapingService) {
            scrapingService = new ScrapingService();
        }
        if (!geminiService) {
            geminiService = new GeminiService();
        }
        return true;
    } catch (error) {
        console.error('Service initialization failed:', error.message);
        console.error('Services will be initialized when first needed');
        return false;
    }
}

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
    .then(() => {
        console.log('Connected to MongoDB Atlas');

        // Initialize services and start scheduled scraping if successful
        const servicesInitialized = initializeServices();
        if (servicesInitialized && scrapingService) {
            scrapingService.startScheduledScraping();
            console.log('Scheduled scraping started');
        } else {
            console.warn('Services not initialized - scheduled scraping will not start');
            console.warn('Please check your environment configuration (API keys, etc.)');
        }
    })
    .catch((error) => {
        console.error('MongoDB connection error:', error);
        process.exit(1);
    });

// Routes
app.use('/api/hackathons', hackathonsRoutes);
app.use('/api/admin', adminRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
    });
});

// Serve the main HTML file for all non-API routes
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Unhandled error:', error);
    res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
    });
});

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('Shutting down gracefully...');
    await mongoose.connection.close();
    process.exit(0);
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
