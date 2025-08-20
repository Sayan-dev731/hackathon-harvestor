const express = require('express');
const Hackathon = require('../models/hackathon');
const router = express.Router();

// Get all hackathons with filtering and search
router.get('/', async (req, res) => {
    try {
        const {
            search,
            status,
            mode,
            startDate,
            endDate,
            location,
            page = 1,
            limit = 12,
            sortBy = 'startDate',
            sortOrder = 'asc'
        } = req.query;

        // Build query
        let query = {};

        // Text search
        if (search) {
            query.$text = { $search: search };
        }

        // Status filter
        if (status && status !== 'all') {
            query.status = status;
        }

        // Mode filter
        if (mode && mode !== 'all') {
            query.mode = mode;
        }

        // Date range filter
        if (startDate && endDate) {
            query.startDate = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        } else if (startDate) {
            query.startDate = { $gte: new Date(startDate) };
        } else if (endDate) {
            query.endDate = { $lte: new Date(endDate) };
        }

        // Location filter
        if (location && location !== 'all') {
            query.location = new RegExp(location, 'i');
        }

        // Auto-update status based on dates
        await updateHackathonStatuses();

        // Execute query
        const options = {
            page: parseInt(page),
            limit: parseInt(limit),
            sort: { [sortBy]: sortOrder === 'desc' ? -1 : 1 }
        };

        const hackathons = await Hackathon.find(query)
            .sort(options.sort)
            .limit(options.limit * 1)
            .skip((options.page - 1) * options.limit)
            .exec();

        const total = await Hackathon.countDocuments(query);

        res.json({
            hackathons,
            pagination: {
                current: options.page,
                pages: Math.ceil(total / options.limit),
                total
            }
        });
    } catch (error) {
        console.error('Error fetching hackathons:', error);
        res.status(500).json({ error: 'Failed to fetch hackathons' });
    }
});

// Get single hackathon
router.get('/:id', async (req, res) => {
    try {
        const hackathon = await Hackathon.findById(req.params.id);
        if (!hackathon) {
            return res.status(404).json({ error: 'Hackathon not found' });
        }
        res.json(hackathon);
    } catch (error) {
        console.error('Error fetching hackathon:', error);
        res.status(500).json({ error: 'Failed to fetch hackathon' });
    }
});

// Get hackathon statistics
router.get('/stats/overview', async (req, res) => {
    try {
        const totalHackathons = await Hackathon.countDocuments();
        const upcomingHackathons = await Hackathon.countDocuments({ status: 'upcoming' });
        const ongoingHackathons = await Hackathon.countDocuments({ status: 'ongoing' });
        const completedHackathons = await Hackathon.countDocuments({ status: 'completed' });

        const modeStats = await Hackathon.aggregate([
            { $group: { _id: '$mode', count: { $sum: 1 } } }
        ]);

        const recentHackathons = await Hackathon.find()
            .sort({ extractedAt: -1 })
            .limit(5)
            .select('name startDate endDate status');

        res.json({
            total: totalHackathons,
            upcoming: upcomingHackathons,
            ongoing: ongoingHackathons,
            completed: completedHackathons,
            modeDistribution: modeStats,
            recent: recentHackathons
        });
    } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({ error: 'Failed to fetch statistics' });
    }
});

// Helper function to update hackathon statuses
async function updateHackathonStatuses() {
    const now = new Date();

    try {
        // Update to ongoing
        await Hackathon.updateMany(
            {
                startDate: { $lte: now },
                endDate: { $gte: now },
                status: 'upcoming'
            },
            { status: 'ongoing' }
        );

        // Update to completed
        await Hackathon.updateMany(
            {
                endDate: { $lt: now },
                status: { $in: ['upcoming', 'ongoing'] }
            },
            { status: 'completed' }
        );
    } catch (error) {
        console.error('Error updating hackathon statuses:', error);
    }
}

module.exports = router;
