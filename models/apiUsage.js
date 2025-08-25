const mongoose = require('mongoose');

const apiUsageSchema = new mongoose.Schema({
    date: {
        type: String, // YYYY-MM-DD format
        required: true,
        unique: true
    },
    geminiApiCalls: {
        type: Number,
        default: 0
    },
    dailyLimit: {
        type: Number,
        default: 100 // Default daily limit for Gemini API
    },
    lastReset: {
        type: Date,
        default: Date.now
    },
    autoFetchRuns: {
        type: Number,
        default: 0
    },
    lastAutoFetch: {
        type: Date
    }
}, {
    timestamps: true
});

// Method to check if API limit is reached
apiUsageSchema.methods.isLimitReached = function () {
    return this.geminiApiCalls >= this.dailyLimit;
};

// Method to increment API usage
apiUsageSchema.methods.incrementUsage = function () {
    this.geminiApiCalls += 1;
    return this.save();
};

// Static method to get or create today's usage
apiUsageSchema.statics.getTodaysUsage = async function () {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    let usage = await this.findOne({ date: today });

    if (!usage) {
        usage = new this({
            date: today,
            geminiApiCalls: 0,
            dailyLimit: 100,
            lastReset: new Date()
        });
        await usage.save();
    }

    return usage;
};

// Static method to reset daily counters (called automatically)
apiUsageSchema.statics.resetIfNeeded = async function () {
    const today = new Date().toISOString().split('T')[0];
    const usage = await this.findOne({ date: today });

    if (!usage) {
        return await this.getTodaysUsage();
    }

    return usage;
};

module.exports = mongoose.model('ApiUsage', apiUsageSchema);
