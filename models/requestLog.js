const mongoose = require('mongoose');

const requestLogSchema = new mongoose.Schema({
    date: {
        type: Date,
        required: true,
        default: Date.now
    },
    requestCount: {
        type: Number,
        default: 0
    },
    apiProvider: {
        type: String,
        default: 'gemini'
    }
}, {
    timestamps: true
});

// Ensure only one document per date
requestLogSchema.index({ date: 1, apiProvider: 1 }, { unique: true });

module.exports = mongoose.model('RequestLog', requestLogSchema);
