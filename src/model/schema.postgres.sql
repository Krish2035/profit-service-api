-- PostgreSQL Schema for Profit Service

CREATE TABLE IF NOT EXISTS products (
    id VARCHAR(64) PRIMARY KEY,
    sku VARCHAR(128) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS product_cost_history (
    id VARCHAR(64) PRIMARY KEY,
    product_id VARCHAR(64) NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    cost NUMERIC(12, 4) NOT NULL CHECK (cost >= 0),
    effective_from VARCHAR(64) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cost_history_lookup 
ON product_cost_history (product_id, effective_from DESC, created_at DESC);

CREATE TABLE IF NOT EXISTS orders (
    id VARCHAR(64) PRIMARY KEY,
    order_id VARCHAR(128) UNIQUE NOT NULL,
    created_at VARCHAR(64) NOT NULL,
    shipping_cost NUMERIC(12, 4) NOT NULL DEFAULT 0 CHECK (shipping_cost >= 0),
    total_revenue NUMERIC(12, 4) NOT NULL,
    total_cogs NUMERIC(12, 4) NOT NULL,
    total_profit NUMERIC(12, 4) NOT NULL,
    processed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS order_items (
    id VARCHAR(64) PRIMARY KEY,
    order_id VARCHAR(128) NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,
    product_id VARCHAR(64) NOT NULL REFERENCES products(id),
    sku VARCHAR(128) NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    selling_price NUMERIC(12, 4) NOT NULL CHECK (selling_price >= 0),
    unit_cost NUMERIC(12, 4) NOT NULL CHECK (unit_cost >= 0),
    item_revenue NUMERIC(12, 4) NOT NULL,
    item_cogs NUMERIC(12, 4) NOT NULL,
    item_profit NUMERIC(12, 4) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id 
ON order_items (order_id);

CREATE TABLE IF NOT EXISTS refresh_tokens (
    id VARCHAR(64) PRIMARY KEY,
    token TEXT UNIQUE NOT NULL,
    user_id VARCHAR(128) NOT NULL,
    expires_at VARCHAR(64) NOT NULL,
    revoked_at VARCHAR(64),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token 
ON refresh_tokens (token);
