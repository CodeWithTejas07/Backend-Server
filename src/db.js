const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.resolve(__dirname, 'database.sqlite');

const db = new Database(dbPath, { verbose: console.log });

// Initialize tables
db.exec(`CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE,
    description TEXT,
    buy_link TEXT,
    emoji TEXT DEFAULT '📦',
    type TEXT DEFAULT 'plugin',
    version TEXT DEFAULT '1.0',
    mc_version TEXT DEFAULT '1.20+',
    features TEXT DEFAULT '',
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)`);

// Migrate old products table — add new columns if missing
const alterCols = ['buy_link TEXT', 'emoji TEXT DEFAULT \'📦\'', 'type TEXT DEFAULT \'plugin\'', 'version TEXT DEFAULT \'1.0\'', 'mc_version TEXT DEFAULT \'1.20+\'', 'features TEXT DEFAULT \'\'', 'is_active INTEGER DEFAULT 1'];
alterCols.forEach(col => {
    try {
        db.exec(`ALTER TABLE products ADD COLUMN ${col}`);
    } catch (e) {
        // silently ignore if column exists
    }
});

db.exec(`CREATE TABLE IF NOT EXISTS licenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT UNIQUE,
    product_name TEXT,
    user_id TEXT,
    bound_ip TEXT,
    status TEXT DEFAULT 'active',
    expires_at DATETIME,
    reset_count INTEGER DEFAULT 0,
    max_resets INTEGER DEFAULT 3,
    last_reset_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)`);

db.exec(`CREATE TABLE IF NOT EXISTS api_keys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT UNIQUE,
    name TEXT,
    role TEXT DEFAULT 'admin',
    status TEXT DEFAULT 'active',
    expires_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_used_at DATETIME
)`);
try { db.exec('ALTER TABLE api_keys ADD COLUMN role TEXT DEFAULT "admin"'); } catch (e) {}

db.exec(`CREATE TABLE IF NOT EXISTS logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    license_key TEXT,
    ip TEXT,
    action TEXT,
    result TEXT,
    message TEXT,
    user_id TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
)`);

db.exec(`CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
)`);

// Default settings
db.exec(`INSERT OR IGNORE INTO settings (key, value) VALUES ('discord_link', 'https://discord.gg/yourlink')`);

// Initialize Master API Key
db.exec(`INSERT OR IGNORE INTO api_keys (key, name, role) VALUES ('libot_master_7b2a9c3e1d4f5g6h7j8k9l0m', 'Master Admin', 'admin')`);

module.exports = {
    run: (sql, params = []) => new Promise((resolve, reject) => {
        try {
            const stmt = db.prepare(sql);
            const info = stmt.run(...params);
            resolve({ id: info.lastInsertRowid, changes: info.changes });
        } catch (err) {
            reject(err);
        }
    }),
    get: (sql, params = []) => new Promise((resolve, reject) => {
        try {
            const stmt = db.prepare(sql);
            const row = stmt.get(...params);
            resolve(row);
        } catch (err) {
            reject(err);
        }
    }),
    all: (sql, params = []) => new Promise((resolve, reject) => {
        try {
            const stmt = db.prepare(sql);
            const rows = stmt.all(...params);
            resolve(rows);
        } catch (err) {
            reject(err);
        }
    })
};
