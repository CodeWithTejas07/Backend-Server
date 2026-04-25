const mongoose = require('mongoose');

const licenseSchema = new mongoose.Schema({
    key: { type: String, required: true, unique: true },
    productName: { type: String, required: true },
    userId: { type: String }, // Discord user ID
    boundIp: { type: String },
    status: { type: String, enum: ['active', 'revoked', 'expired'], default: 'active' },
    expiresAt: { type: Date }, // Null for lifetime
    resetCount: { type: Number, default: 0 },
    maxResets: { type: Number, default: 3 },
    lastResetAt: { type: Date },
    createdAt: { type: Date, default: Date.now },
    logs: [{
        timestamp: { type: Date, default: Date.now },
        ip: String,
        action: String,
        result: String,
        message: String
    }]
});

module.exports = mongoose.model('License', licenseSchema);
