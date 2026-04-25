const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');
const crypto = require('crypto');

const generateApiKey = () => crypto.randomBytes(32).toString('hex');

router.post('/create', async (req, res) => {
    const { name, days } = req.body;
    const key = generateApiKey();
    const expiresAt = days === 'lifetime' ? null : new Date(Date.now() + (parseInt(days) * 24 * 60 * 60 * 1000)).toISOString();

    await db.run('INSERT INTO api_keys (key, name, expires_at) VALUES (?, ?, ?)', [key, name, expiresAt]);
    res.json({ success: true, key });
});

router.get('/list', auth, async (req, res) => {
    const keys = await db.all('SELECT name, status, expires_at, last_used_at FROM api_keys');
    res.json({ success: true, keys });
});

module.exports = router;
