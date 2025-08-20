const mongoose = require('mongoose');

const hackathonSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    description: {
        type: String,
        default: ''
    },
    website: {
        type: String,
        required: true,
        unique: true
    },
    startDate: {
        type: Date,
        required: true
    },
    endDate: {
        type: Date,
        required: true
    },
    registrationDeadline: {
        type: Date
    },
    location: {
        type: String,
        default: 'Online'
    },
    mode: {
        type: String,
        enum: ['Online', 'Offline', 'Hybrid'],
        default: 'Online'
    },
    prizes: [{
        position: String,
        amount: String,
        description: String
    }],
    eligibility: {
        type: String,
        default: ''
    },
    themes: [{
        type: String
    }],
    organizer: {
        type: String,
        default: ''
    },
    contactInfo: {
        email: String,
        phone: String,
        social: {
            twitter: String,
            linkedin: String,
            discord: String
        }
    },
    registrationLink: {
        type: String
    },
    status: {
        type: String,
        enum: ['upcoming', 'ongoing', 'completed', 'cancelled'],
        default: 'upcoming'
    },
    participants: {
        current: {
            type: Number,
            default: 0
        },
        max: {
            type: Number
        }
    },
    extractedAt: {
        type: Date,
        default: Date.now
    },
    lastUpdated: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Index for efficient searching
hackathonSchema.index({ name: 'text', description: 'text', themes: 'text' });
hackathonSchema.index({ startDate: 1, endDate: 1 });
hackathonSchema.index({ status: 1 });

module.exports = mongoose.model('Hackathon', hackathonSchema);
