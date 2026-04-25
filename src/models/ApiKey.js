const mongoose = require('mongoose');

const apiKeySchema = new mongoose.Schema({
    key: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    status: { type: String, enum: ['active', 'revoked'], default: 'active' },
    expiresAt: { type: Date },
    createdAt: { type: Date, default: Date.now },
    lastUsedAt: { type: Date }
});

module.exports = mongoose.model('ApiKey', apiKeySchema);
