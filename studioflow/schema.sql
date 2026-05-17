CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    notes TEXT,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL,
    session_date TEXT NOT NULL,
    session_type TEXT,
    photographer TEXT,
    folder_path TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (customer_id) REFERENCES customers(id)
);

CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_number TEXT NOT NULL UNIQUE,
    session_id INTEGER NOT NULL,
    status TEXT NOT NULL,
    deadline TEXT,
    notes TEXT,
    created_at TEXT NOT NULL,
    confirmed_at TEXT,
    FOREIGN KEY (session_id) REFERENCES sessions(id)
);

CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    image_filename TEXT NOT NULL,
    product TEXT NOT NULL,
    size TEXT,
    frame TEXT,
    quantity INTEGER NOT NULL,
    variant TEXT NOT NULL,
    retouch_type TEXT NOT NULL,
    retoucher TEXT,
    notes TEXT,
    FOREIGN KEY (order_id) REFERENCES orders(id)
);

CREATE TABLE IF NOT EXISTS email_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    retoucher TEXT,
    email_to TEXT,
    subject TEXT,
    body TEXT,
    status TEXT,
    created_at TEXT NOT NULL,
    sent_at TEXT,
    error_message TEXT,
    FOREIGN KEY (order_id) REFERENCES orders(id)
);

CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
);

INSERT OR IGNORE INTO settings (key, value) VALUES
    ('studio_name', 'Fotograf Guld / Aarsbilleder'),
    ('base_folder_path', 'generated_test_server'),
    ('enable_folder_creation', '0'),
    ('default_retouchers', 'Nadhif, Marija'),
    ('smtp_host', ''),
    ('smtp_port', ''),
    ('smtp_username', ''),
    ('smtp_password', ''),
    ('smtp_sender_email', '');
