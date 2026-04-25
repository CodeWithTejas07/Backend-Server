const db = require('../db');

const authMiddleware = async (req, res, next) => {
    const key = req.headers['x-api-key'];
    if (!key) return res.status(401).json({ valid: false, message: 'API key required' });

    try {
        const apiKey = await db.get('SELECT * FROM api_keys WHERE key = ? AND status = "active"', [key]);
        if (!apiKey) return res.status(403).json({ valid: false, message: 'Invalid API key' });

        if (apiKey.expires_at && new Date(apiKey.expires_at) < new Date()) {
            await db.run('UPDATE api_keys SET status = "revoked" WHERE key = ?', [key]);
            return res.status(403).json({ valid: false, message: 'API key expired' });
        }

        await db.run('UPDATE api_keys SET last_used_at = ? WHERE key = ?', [new Date().toISOString(), key]);
        req.apiKey = apiKey;
        next();
    } catch (e) {
        res.status(500).json({ valid: false, message: e.message });
    }
};

module.exports = authMiddleware;
