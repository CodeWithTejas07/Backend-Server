require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./src/db');

// Import routes and middleware
const licenseRoutes  = require('./src/routes/licenseRoutes');
const apiRoutes      = require('./src/routes/apiRoutes');
const productRoutes  = require('./src/routes/productRoutes');

const app = express();

// ── CORS: allow all origins so Vercel-hosted frontend can reach this API ──
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'x-api-key', 'Authorization'],
}));
app.use(express.json());

// Logger middleware
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

// ── Root sanity check ──
app.get('/', (req, res) => {
    res.json({ message: 'Desact Studios License API is running ✓' });
});

// ── PUBLIC endpoint — no API key needed ──
// Used by the website license checker for visitors
app.post('/api/public/check', async (req, res) => {
    const { license_key } = req.body;
    if (!license_key) return res.status(400).json({ valid: false, message: 'No key provided' });
    try {
        const license = await db.get('SELECT key, product_name, status, bound_ip, expires_at FROM licenses WHERE key = ?', [license_key]);
        if (!license) return res.json({ valid: false, message: 'License not found' });
        if (license.status !== 'active') return res.json({ valid: false, message: `License is ${license.status}`, status: license.status });

        if (license.expires_at) {
            const grace = 2 * 24 * 60 * 60 * 1000;
            if (new Date() > new Date(new Date(license.expires_at).getTime() + grace)) {
                await db.run('UPDATE licenses SET status = "expired" WHERE key = ?', [license_key]);
                return res.json({ valid: false, message: 'License expired', status: 'expired' });
            }
        }
        res.json({
            valid: true,
            message: 'License is active',
            license: {
                key: license.key,
                product_name: license.product_name,
                status: license.status,
                bound_ip: license.bound_ip || null,
                expires_at: license.expires_at || null,
            }
        });
    } catch (e) {
        res.status(500).json({ valid: false, message: 'Server error' });
    }
});

// ── Protected routes ──
app.use('/api/licenses', licenseRoutes);
app.use('/api/keys', apiRoutes);
app.use('/api/products', productRoutes);

// Fallback compatibility
app.use('/api', licenseRoutes);
app.use('/', licenseRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`✓ Desact Backend running on http://localhost:${PORT}`);
});
