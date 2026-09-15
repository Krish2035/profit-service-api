-- Products table
CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    sku TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Product Cost History table
CREATE TABLE IF NOT EXISTS product_cost_history (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL,
    cost REAL NOT NULL CHECK(cost >= 0),
    effective_from TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_cost_history_lookup 
ON product_cost_history (product_id, effective_from DESC, created_at DESC);

-- Orders table
CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    order_id TEXT UNIQUE NOT NULL,
    created_at TEXT NOT NULL,
    shipping_cost REAL NOT NULL DEFAULT 0 CHECK(shipping_cost >= 0),
    total_revenue REAL NOT NULL,
    total_cogs REAL NOT NULL,
    total_profit REAL NOT NULL,
    processed_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Order Items table
CREATE TABLE IF NOT EXISTS order_items (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    sku TEXT NOT NULL,
    quantity INTEGER NOT NULL CHECK(quantity > 0),
    selling_price REAL NOT NULL CHECK(selling_price >= 0),
    unit_cost REAL NOT NULL CHECK(unit_cost >= 0),
    item_revenue REAL NOT NULL,
    item_cogs REAL NOT NULL,
    item_profit REAL NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id 
ON order_items (order_id);

-- Refresh Tokens table (JWT rotation & revocation)
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id TEXT PRIMARY KEY,
    token TEXT UNIQUE NOT NULL,
    user_id TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    revoked_at TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token 
ON refresh_tokens (token);
