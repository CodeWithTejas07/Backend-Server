const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');

// Utility to generate FFA-XXXX-XXXX format
const generateKey = (productPrefix = "FFA") => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const segment = () => Array.from({length: 4}, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    return `${productPrefix}-${segment()}-${segment()}`;
};

// POST /validate
const validateHandler = async (req, res) => {
    let { license_key, server_ip } = req.body;
    const product_name = req.body.product_name || "FFA Plugin";
    
    // Auto-detect IP if plugin sends "unknown" or "AUTO_DETECT"
    if (!server_ip || server_ip === 'unknown' || server_ip === 'AUTO_DETECT') {
        server_ip = req.ip.replace('::ffff:', ''); // Clean up IPv4-mapped-IPv6
    }

    if (!license_key || !server_ip) {
        return res.status(400).json({ valid: false, message: "Missing required fields" });
    }

    try {
        const license = await db.get('SELECT * FROM licenses WHERE key = ?', [license_key]);
        if (!license) return res.json({ valid: false, message: "License not found" });
        if (license.product_name !== product_name) return res.json({ valid: false, message: "Product mismatch" });
        if (license.status !== 'active') return res.json({ valid: false, message: `License is ${license.status}` });

        if (license.expires_at) {
            const expiry = new Date(license.expires_at);
            const grace = 2 * 24 * 60 * 60 * 1000;
            if (new Date() > new Date(expiry.getTime() + grace)) {
                await db.run("UPDATE licenses SET status = 'expired' WHERE key = ?", [license_key]);
                return res.json({ valid: false, message: "License expired" });
            }
        }

        if (!license.bound_ip) {
            await db.run('UPDATE licenses SET bound_ip = ? WHERE key = ?', [server_ip, license_key]);
            await db.run('INSERT INTO logs (license_key, ip, action, result, message) VALUES (?, ?, ?, ?, ?)', [license_key, server_ip, 'validate', 'success', 'Bound to IP']);
            return res.json({ valid: true, message: "License bound and validated" });
        }

        if (license.bound_ip !== server_ip) {
            await db.run('INSERT INTO logs (license_key, ip, action, result, message) VALUES (?, ?, ?, ?, ?)', [license_key, server_ip, 'validate', 'fail', 'IP Mismatch']);
            return res.json({ valid: false, message: "IP Mismatch. Bound to " + license.bound_ip });
        }

        await db.run('INSERT INTO logs (license_key, ip, action, result, message) VALUES (?, ?, ?, ?, ?)', [license_key, server_ip, 'validate', 'success', 'Validated']);
        res.json({ valid: true, message: "Valid" });
    } catch (e) {
        res.status(500).json({ valid: false, message: e.message });
    }
};

router.post('/validate', auth, validateHandler);
router.post('/', auth, validateHandler);

// POST /reset
router.post('/reset', auth, async (req, res) => {
    const { license_key, user_id } = req.body;
    try {
        const license = await db.get('SELECT * FROM licenses WHERE key = ?', [license_key]);
        if (!license) return res.status(404).json({ success: false, message: "Not found" });
        
        // Ownership check (only if user_id is provided, admin commands omit this)
        if (user_id && license.user_id !== user_id) {
            return res.status(403).json({ success: false, message: "Ownership verification failed" });
        }

        // 5 resets per day limit
        if (user_id) {
            const today = new Date().toISOString().substring(0, 10);
            const row = await db.get("SELECT COUNT(*) as count FROM logs WHERE license_key = ? AND action = 'reset' AND timestamp LIKE ?", [license_key, `${today}%`]);
            if (row && row.count >= 5) {
                return res.status(400).json({ success: false, message: "Daily limit reached (max 5 resets per day)" });
            }
        }

        await db.run('UPDATE licenses SET bound_ip = NULL, reset_count = reset_count + 1, last_reset_at = ? WHERE key = ?', [new Date().toISOString(), license_key]);
        await db.run('INSERT INTO logs (license_key, ip, action, result, message, user_id) VALUES (?, ?, ?, ?, ?, ?)', 
            [license_key, 'N/A', 'reset', 'success', 'IP reset', user_id]);

        res.json({ success: true, message: "Reset successful" });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// POST /generate
router.post('/generate', auth, async (req, res) => {
    const { product_name, days, user_id, max_resets } = req.body;
    
    // Auto-create product if it doesn't exist
    let product = await db.get('SELECT * FROM products WHERE name = ?', [product_name]);
    if (!product) {
        await db.run('INSERT INTO products (name, description) VALUES (?, ?)', [product_name, `Auto-created product: ${product_name}`]);
        product = await db.get('SELECT * FROM products WHERE name = ?', [product_name]);
    }

    const key = generateKey(product_name.substring(0, 3).toUpperCase());
    const expiresAt = days === 'lifetime' ? null : new Date(Date.now() + (parseInt(days) * 24 * 60 * 60 * 1000)).toISOString();
    const resets = max_resets ? parseInt(max_resets) : 3;

    // user_id starts as NULL (unclaimed) unless specified
    await db.run('INSERT INTO licenses (key, product_name, user_id, expires_at, max_resets) VALUES (?, ?, ?, ?, ?)', 
        [key, product_name, user_id || null, expiresAt, resets]);
    
    res.json({ 
        success: true, 
        key, 
        product: product_name, 
        status: 'active', 
        expiresAt, 
        max_resets: resets 
    });
});

// POST /claim
router.post('/claim', auth, async (req, res) => {
    const { license_key, user_id } = req.body;
    
    try {
        const license = await db.get('SELECT * FROM licenses WHERE key = ?', [license_key]);
        if (!license) return res.status(404).json({ success: false, message: "License not found" });
        
        if (license.user_id) {
            return res.status(400).json({ success: false, message: "License already claimed" });
        }

        await db.run('UPDATE licenses SET user_id = ? WHERE key = ?', [user_id, license_key]);
        await db.run('INSERT INTO logs (license_key, ip, action, result, message, user_id) VALUES (?, ?, ?, ?, ?, ?)', 
            [license_key, 'N/A', 'claim', 'success', `Claimed by ${user_id}`, user_id]);
            
        res.json({ success: true, message: "License claimed successfully!" });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// POST /rotate (Works like reset but can have different cooldown/logic)
router.post('/rotate', auth, async (req, res) => {
    const { license_key, user_id } = req.body;
    
    try {
        const license = await db.get('SELECT * FROM licenses WHERE key = ?', [license_key]);
        if (!license) return res.status(404).json({ success: false, message: "Not found" });
        
        // Ownership Check (only if user_id is provided, admin commands omit this)
        if (user_id && license.user_id !== user_id) {
            return res.status(403).json({ success: false, message: "You do not own this license" });
        }

        // 6 hour cooldown for rotate
        const rotateCooldown = 6 * 60 * 60 * 1000;
        if (user_id && license.last_reset_at && (new Date() - new Date(license.last_reset_at)) < rotateCooldown) {
            return res.status(400).json({ success: false, message: "Cooldown active (please wait 6 hours between rotations)" });
        }

        await db.run('UPDATE licenses SET bound_ip = NULL, last_reset_at = ? WHERE key = ?', [new Date().toISOString(), license_key]);
        await db.run('INSERT INTO logs (license_key, ip, action, result, message, user_id) VALUES (?, ?, ?, ?, ?, ?)', 
            [license_key, 'N/A', 'rotate', 'success', 'IP rotated', user_id]);

        res.json({ success: true, message: "IP rotated successfully. Next validation will bind new IP." });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// GET /user/:user_id
router.get('/user/:user_id', auth, async (req, res) => {
    try {
        const licenses = await db.all('SELECT * FROM licenses WHERE user_id = ?', [req.params.user_id]);
        res.json({ success: true, licenses });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server error" });
    }
});

// GET /info/:key
router.get('/info/:key', auth, async (req, res) => {
    const license = await db.get('SELECT * FROM licenses WHERE key = ?', [req.params.key]);
    if (!license) return res.status(404).json({ success: false, message: "Not found" });
    res.json({ success: true, license });
});

// POST /revoke
router.post('/revoke', auth, async (req, res) => {
    const { license_key } = req.body;
    try {
        const license = await db.get('SELECT * FROM licenses WHERE key = ?', [license_key]);
        if (!license) return res.status(404).json({ success: false, message: "License not found" });

        await db.run("UPDATE licenses SET status = 'revoked' WHERE key = ?", [license_key]);
        await db.run('INSERT INTO logs (license_key, ip, action, result, message) VALUES (?, ?, ?, ?, ?)', 
            [license_key, 'N/A', 'revoke', 'success', 'License revoked by admin']);

        res.json({ success: true, message: "License revoked successfully" });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server error" });
    }
});

// POST /transfer
router.post('/transfer', auth, async (req, res) => {
    const { license_key, new_user_id } = req.body;
    try {
        const license = await db.get('SELECT * FROM licenses WHERE key = ?', [license_key]);
        if (!license) return res.status(404).json({ success: false, message: "License not found" });

        const oldUser = license.user_id;
        await db.run('UPDATE licenses SET user_id = ? WHERE key = ?', [new_user_id, license_key]);
        await db.run('INSERT INTO logs (license_key, ip, action, result, message, user_id) VALUES (?, ?, ?, ?, ?, ?)', 
            [license_key, 'N/A', 'transfer', 'success', `Transferred from ${oldUser} to ${new_user_id}`, new_user_id]);

        res.json({ success: true, message: `License transferred to <@${new_user_id}>` });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server error" });
    }
});

// GET /all — List all licenses (admin dashboard)
router.get('/all', auth, async (req, res) => {
    try {
        const licenses = await db.all('SELECT * FROM licenses ORDER BY rowid DESC');
        res.json({ success: true, licenses });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// GET /logs — View all activity logs (admin dashboard)
router.get('/logs', auth, async (req, res) => {
    try {
        const limit = req.query.limit ? parseInt(req.query.limit) : 200;
        const logs = await db.all('SELECT * FROM logs ORDER BY rowid DESC LIMIT ?', [limit]);
        res.json({ success: true, logs });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

module.exports = router;

