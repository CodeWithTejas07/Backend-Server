const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');

// GET /all — list all products (admin)
router.get('/all', auth, async (req, res) => {
    try {
        const products = await db.all('SELECT * FROM products ORDER BY created_at DESC');
        res.json({ success: true, products });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// GET /public — list all products (no auth, for website store)
router.get('/public', async (req, res) => {
    try {
        const products = await db.all('SELECT id, name, description, buy_link, emoji, type, version, mc_version, features, is_active FROM products WHERE is_active = 1 ORDER BY created_at DESC');
        res.json({ success: true, products });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// POST /create — create a new product
router.post('/create', auth, async (req, res) => {
    const { name, description, buy_link, emoji, type, version, mc_version, features } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Product name is required' });
    try {
        const existing = await db.get('SELECT id FROM products WHERE name = ?', [name]);
        if (existing) return res.status(400).json({ success: false, message: 'Product already exists' });
        const featuresStr = Array.isArray(features) ? features.join(',') : (features || '');
        await db.run(
            'INSERT INTO products (name, description, buy_link, emoji, type, version, mc_version, features, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)',
            [name, description || '', buy_link || '', emoji || '📦', type || 'plugin', version || '1.0', mc_version || '1.20+', featuresStr]
        );
        res.json({ success: true, message: `Product "${name}" created!` });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// POST /update — update an existing product
router.post('/update', auth, async (req, res) => {
    const { id, name, description, buy_link, emoji, type, version, mc_version, features, is_active } = req.body;
    if (!id) return res.status(400).json({ success: false, message: 'Product ID is required' });
    try {
        const featuresStr = Array.isArray(features) ? features.join(',') : (features || '');
        await db.run(
            'UPDATE products SET name=?, description=?, buy_link=?, emoji=?, type=?, version=?, mc_version=?, features=?, is_active=? WHERE id=?',
            [name, description, buy_link, emoji, type, version, mc_version, featuresStr, is_active ? 1 : 0, id]
        );
        res.json({ success: true, message: 'Product updated!' });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// POST /delete — delete a product
router.post('/delete', auth, async (req, res) => {
    const { id } = req.body;
    if (!id) return res.status(400).json({ success: false, message: 'Product ID required' });
    try {
        await db.run('DELETE FROM products WHERE id = ?', [id]);
        res.json({ success: true, message: 'Product deleted' });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

module.exports = router;
