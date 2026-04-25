const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.resolve(__dirname, 'database.sqlite');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) console.error('Database opening error: ', err);
});

// Initialize tables
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS products (
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
        const colName = col.split(' ')[0];
        db.run(`ALTER TABLE products ADD COLUMN ${col}`, () => {}); // silently fails if column exists
    });

    db.run(`CREATE TABLE IF NOT EXISTS licenses (
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

    db.run(`CREATE TABLE IF NOT EXISTS api_keys (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT UNIQUE,
        name TEXT,
        status TEXT DEFAULT 'active',
        expires_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_used_at DATETIME
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        license_key TEXT,
        ip TEXT,
        action TEXT,
        result TEXT,
        message TEXT,
        user_id TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
});

module.exports = {
    run: (sql, params = []) => new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) reject(err);
            else resolve({ id: this.lastID, changes: this.changes });
        });
    }),
    get: (sql, params = []) => new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    }),
    all: (sql, params = []) => new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    })
};
