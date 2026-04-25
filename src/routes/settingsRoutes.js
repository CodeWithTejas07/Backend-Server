const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');

// GET /api/settings/:key
router.get('/:key', async (req, res) => {
    try {
        const setting = await db.get('SELECT value FROM settings WHERE key = ?', [req.params.key]);
        res.json({ success: true, value: setting ? setting.value : null });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// POST /api/settings/update
router.post('/update', auth, async (req, res) => {
    const { key, value } = req.body;
    if (!key) return res.status(400).json({ success: false, message: 'Key required' });
    try {
        await db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, value]);
        res.json({ success: true, message: `Setting ${key} updated!` });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

module.exports = router;
