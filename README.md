# Shopify-like Order Profit Backend Service

A high-performance backend service built with Node.js, TypeScript, Express, **Drizzle ORM**, SQLite, and Zod that calculates revenue, COGS, shipping, and profit for orders while supporting date-effective historical product costs.

Equipped with **API Key / Bearer Token Authentication** and **Rate Limiting Middleware**.

---

## Features

- **Drizzle ORM**: Type-safe schema definitions, relationships, and queries with compile-time safety and atomic transactions.
- **Date-Effective Cost Resolution**: Resolves the active unit cost at the time an order was placed (`effective_from <= order.created_at`).
- **Granular Financial Metrics**: Computes and persists item-level and order-level Revenue, COGS, Shipping, and Profit.
- **Aggregated Dashboard**: Real-time summary across all orders for high-level business analytics using Drizzle SQL aggregations.
- **Strict Validation with Zod**: Validates positive quantities, non-negative prices, shipping, costs, valid dates, duplicate SKUs across products, and duplicate items per order.
- **Authentication Middleware**: Supports both `X-API-Key: <key>` and `Authorization: Bearer <key>` headers. `/health` is public.
- **Rate Limiting**: Integrated `express-rate-limit` protecting against brute-force and DDoS.
- **Clean Layered Architecture**:
  - `src/model/`: Drizzle schemas, database connection, relations, and entity types.
  - `src/schemas/`: Zod validation schemas.
  - `src/services/`: Business logic (cost lookup, profit calculations, aggregations).
  - `src/controllers/`: Request handling and HTTP status codes.
  - `src/routes/`: Route declarations.
  - `src/middlewares/`: Validation, Authentication, Rate Limiting, and centralized error handling.

---

## Project Structure

```
.
├── package.json
├── tsconfig.json
├── profit_service.db       # Created on server startup
├── src/
│   ├── app.ts              # Express app factory with middlewares
│   ├── server.ts           # Server entry point
│   ├── config.ts           # Configuration (Port, DB path, API Key, Rate Limit)
│   ├── model/              # Drizzle ORM data layer
│   │   ├── schema.ts       # Drizzle table schemas & relations
│   │   ├── database.ts     # SQLite connection & Drizzle instance
│   │   ├── schema.sql      # DDL migrations
│   │   └── types.ts        # Inferred Drizzle models & types
│   ├── schemas/            # Zod validation schemas
│   │   ├── product.schema.ts
│   │   └── order.schema.ts
│   ├── services/           # Business logic
│   │   ├── product.service.ts
│   │   ├── order.service.ts
│   │   └── dashboard.service.ts
│   ├── controllers/        # HTTP controllers
│   │   ├── product.controller.ts
│   │   ├── order.controller.ts
│   │   └── dashboard.controller.ts
│   ├── routes/             # Express routes
│   │   ├── product.routes.ts
│   │   ├── order.routes.ts
│   │   ├── dashboard.routes.ts
│   │   └── index.ts
│   └── middlewares/
│       ├── auth.ts         # API Key & Bearer token authentication
│       ├── rate-limiter.ts # Express rate limiting
│       ├── validate.ts     # Zod request validation
│       └── error-handler.ts# Centralized error handling
└── tests/
    ├── auth.test.ts        # Authentication & public endpoint tests
    ├── products.test.ts    # Product & cost history tests
    ├── orders.test.ts      # Order processing & historical cost resolution tests
    └── dashboard.test.ts   # Metrics aggregation tests
```

---

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Tests
```bash
npm test
```

### 3. Start Development Server
```bash
npm run dev
```
The server will start listening at `http://localhost:3000`.

### 4. Production Build & Run
```bash
npm run build
npm start
```

---

## Authentication

All API endpoints (except `GET /health`) require authentication using an API key:
- **Via header**: `X-API-Key: dev_api_key_shopify_2026`
- **Or via Bearer token**: `Authorization: Bearer dev_api_key_shopify_2026`

Configurable via `API_KEY` environment variable in `config.ts`.

---

## API Reference

### Health Check (Public)
`GET /health`
Returns `{ "status": "ok", "timestamp": "..." }`.

---

### 1. Products

#### `POST /products`
Create a new product.

**Headers:**
`X-API-Key: dev_api_key_shopify_2026`

**Request:**
```json
{
  "sku": "SERUM001",
  "name": "Vitamin C Serum"
}
```

**Response (201 Created):**
```json
{
  "id": "e9b7405e-f00e-4363-9a3d-3b7c4d5162a0",
  "sku": "SERUM001",
  "name": "Vitamin C Serum"
}
```

---

#### `POST /products/:id/cost`
Add a historical cost entry for a product (accepts either product `id` or product `sku` in `:id`).

**Request (Jan 2026 cost):**
```json
{
  "cost": 350,
  "effective_from": "2026-01-01"
}
```

**Request (March 2026 cost):**
```json
{
  "cost": 400,
  "effective_from": "2026-03-01"
}
```

**Response (201 Created):**
```json
{
  "id": "f8a7e02b-a01c-43f5-b6d3-2f8a8461de92",
  "product_id": "e9b7405e-f00e-4363-9a3d-3b7c4d5162a0",
  "cost": 350,
  "effective_from": "2026-01-01"
}
```

---

### 2. Orders

#### `POST /orders`
Create an order and calculate profit using the cost active on `created_at`.

**Example:**
- Jan 1 cost = 350
- March 1 cost = 400
- Order date = `2026-02-15` -> Resolves unit cost = **350**

**Request:**
```json
{
  "order_id": "ORD001",
  "created_at": "2026-02-15",
  "shipping_cost": 60,
  "items": [
    {
      "sku": "SERUM001",
      "quantity": 2,
      "selling_price": 999
    }
  ]
}
```

**Calculation Breakdown:**
- $\text{Revenue} = 2 \times 999 = 1998$
- $\text{COGS} = 2 \times 350 = 700$
- $\text{Shipping} = 60$
- $\text{Profit} = 1998 - 700 - 60 = 1238$

**Response (201 Created):**
```json
{
  "order": {
    "id": "426bc0b9-5f21-4f10-ae49-d7547e11f185",
    "order_id": "ORD001",
    "created_at": "2026-02-15",
    "shipping_cost": 60,
    "total_revenue": 1998,
    "total_cogs": 700,
    "total_profit": 1238
  },
  "items": [
    {
      "id": "d1607ef3-585a-45c1-9e23-74d3fb060424",
      "order_id": "ORD001",
      "product_id": "e9b7405e-f00e-4363-9a3d-3b7c4d5162a0",
      "sku": "SERUM001",
      "quantity": 2,
      "selling_price": 999,
      "unit_cost": 350,
      "item_revenue": 1998,
      "item_cogs": 700,
      "item_profit": 1298
    }
  ]
}
```

---

### 3. Dashboard

#### `GET /dashboard`
Fetch total aggregated financial metrics across all orders.

**Response (200 OK):**
```json
{
  "revenue": 100000,
  "cogs": 45000,
  "shipping": 5000,
  "profit": 50000
}
```
