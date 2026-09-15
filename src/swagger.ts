import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Profit Service API',
      version: '1.0.0',
      description: `
## Overview
A backend service that calculates profit for Shopify-like orders while supporting **historical product costs**.

## How It Works
1. **Create products** with SKU and name
2. **Add cost history** — multiple costs with effective dates
3. **Submit orders** — the service resolves the correct cost based on the order date
4. **Check dashboard** — aggregated revenue, COGS, shipping, and profit metrics

## Authentication
All \`/v1\` endpoints require a **JWT Bearer token**.

1. Call \`POST /v1/auth/login\` with your \`api_key\`
2. Copy the returned \`token\`
3. Click **Authorize** and enter: \`Bearer <token>\`
      `,
      contact: {
        name: 'Profit Service API Support',
      },
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Local Development',
      },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT token obtained from POST /v1/auth/login',
        },
      },
      schemas: {
        Product: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid', example: 'a1b2c3d4-...' },
            sku: { type: 'string', example: 'SERUM001' },
            name: { type: 'string', example: 'Vitamin C Serum' },
            created_at: { type: 'string', format: 'date-time' },
          },
        },
        ProductCostHistory: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            product_id: { type: 'string', format: 'uuid' },
            cost: { type: 'number', example: 350 },
            effective_from: { type: 'string', format: 'date', example: '2026-01-01' },
            created_at: { type: 'string', format: 'date-time' },
          },
        },
        OrderItem: {
          type: 'object',
          properties: {
            sku: { type: 'string', example: 'SERUM001' },
            quantity: { type: 'integer', example: 2 },
            selling_price: { type: 'number', example: 999 },
          },
          required: ['sku', 'quantity', 'selling_price'],
        },
        OrderItemResult: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            order_id: { type: 'string', example: 'ORD001' },
            product_id: { type: 'string', format: 'uuid' },
            sku: { type: 'string', example: 'SERUM001' },
            quantity: { type: 'integer', example: 2 },
            selling_price: { type: 'number', example: 999 },
            unit_cost: { type: 'number', example: 350 },
            item_revenue: { type: 'number', example: 1998 },
            item_cogs: { type: 'number', example: 700 },
            item_profit: { type: 'number', example: 1298 },
          },
        },
        Order: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            order_id: { type: 'string', example: 'ORD001' },
            created_at: { type: 'string', format: 'date', example: '2026-02-15' },
            shipping_cost: { type: 'number', example: 60 },
            total_revenue: { type: 'number', example: 1998 },
            total_cogs: { type: 'number', example: 700 },
            total_profit: { type: 'number', example: 1238 },
            processed_at: { type: 'string', format: 'date-time' },
          },
        },
        DashboardMetrics: {
          type: 'object',
          properties: {
            revenue: { type: 'number', example: 100000 },
            cogs: { type: 'number', example: 45000 },
            shipping: { type: 'number', example: 5000 },
            profit: { type: 'number', example: 50000 },
            page: { type: 'integer', example: 1 },
            limit: { type: 'integer', example: 20 },
            total_orders: { type: 'integer', example: 150 },
          },
        },
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string', example: 'Resource not found' },
          },
        },
        ValidationError: {
          type: 'object',
          properties: {
            error: { type: 'string', example: 'Validation Error' },
            details: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  field: { type: 'string' },
                  message: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
    security: [{ BearerAuth: [] }],
    tags: [
      { name: 'Authentication', description: 'Login and token management' },
      { name: 'Products', description: 'Product and cost history management' },
      { name: 'Orders', description: 'Order processing and profit calculation' },
      { name: 'Dashboard', description: 'Aggregated metrics' },
    ],
    paths: {
      '/v1/auth/login': {
        post: {
          tags: ['Authentication'],
          summary: 'Get a JWT access token',
          description: 'Exchange your API key for a signed JWT Bearer token.',
          security: [],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['api_key'],
                  properties: {
                    api_key: { type: 'string', example: 'dev_api_key_shopify_2026' },
                  },
                },
              },
            },
          },
          responses: {
            200: {
              description: 'JWT tokens issued successfully',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      token: { type: 'string' },
                      access_token: { type: 'string' },
                      refresh_token: { type: 'string' },
                      expires_in: { type: 'string', example: '15m' },
                      refresh_expires_in: { type: 'string', example: '7d' },
                      token_type: { type: 'string', example: 'Bearer' },
                    },
                  },
                },
              },
            },
            401: { description: 'Invalid API key', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          },
        },
      },
      '/v1/auth/refresh': {
        post: {
          tags: ['Authentication'],
          summary: 'Refresh access token with token rotation',
          description: 'Submits an active refresh token to obtain a brand new access token and rotated refresh token. The previous refresh token is immediately invalidated.',
          security: [],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['refresh_token'],
                  properties: {
                    refresh_token: { type: 'string' },
                  },
                },
              },
            },
          },
          responses: {
            200: {
              description: 'New tokens issued',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      token: { type: 'string' },
                      access_token: { type: 'string' },
                      refresh_token: { type: 'string' },
                      expires_in: { type: 'string', example: '15m' },
                      refresh_expires_in: { type: 'string', example: '7d' },
                      token_type: { type: 'string', example: 'Bearer' },
                    },
                  },
                },
              },
            },
            401: { description: 'Invalid, expired, or revoked refresh token' },
          },
        },
      },
      '/v1/auth/revoke': {
        post: {
          tags: ['Authentication'],
          summary: 'Revoke refresh token (logout)',
          description: 'Explicitly revokes a refresh token so it cannot be used again.',
          security: [],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['refresh_token'],
                  properties: {
                    refresh_token: { type: 'string' },
                  },
                },
              },
            },
          },
          responses: {
            200: {
              description: 'Token revoked',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      message: { type: 'string', example: 'Refresh token revoked successfully' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/v1/products': {
        post: {
          tags: ['Products'],
          summary: 'Create a new product',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['sku', 'name'],
                  properties: {
                    sku: { type: 'string', example: 'SERUM001' },
                    name: { type: 'string', example: 'Vitamin C Serum' },
                  },
                },
              },
            },
          },
          responses: {
            201: { description: 'Product created', content: { 'application/json': { schema: { $ref: '#/components/schemas/Product' } } } },
            400: { description: 'Validation error', content: { 'application/json': { schema: { $ref: '#/components/schemas/ValidationError' } } } },
            401: { description: 'Unauthorized' },
            409: { description: 'SKU already exists', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          },
        },
      },
      '/v1/products/{id}/cost': {
        post: {
          tags: ['Products'],
          summary: 'Add a cost history entry',
          description: 'Add a new cost effective from a given date. Use the product UUID or its SKU as `{id}`.',
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'Product UUID or SKU', example: 'SERUM001' },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['cost', 'effective_from'],
                  properties: {
                    cost: { type: 'number', minimum: 0, example: 350 },
                    effective_from: { type: 'string', format: 'date', example: '2026-01-01' },
                  },
                },
              },
            },
          },
          responses: {
            201: { description: 'Cost added', content: { 'application/json': { schema: { $ref: '#/components/schemas/ProductCostHistory' } } } },
            400: { description: 'Validation error', content: { 'application/json': { schema: { $ref: '#/components/schemas/ValidationError' } } } },
            404: { description: 'Product not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          },
        },
        get: {
          tags: ['Products'],
          summary: 'Get cost history for a product',
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'Product UUID or SKU' },
          ],
          responses: {
            200: {
              description: 'Cost history list',
              content: {
                'application/json': {
                  schema: { type: 'array', items: { $ref: '#/components/schemas/ProductCostHistory' } },
                },
              },
            },
            404: { description: 'Product not found' },
          },
        },
      },
      '/v1/orders': {
        post: {
          tags: ['Orders'],
          summary: 'Submit an order and calculate profit',
          description: `
Processes an order by:
1. Resolving the **historical unit cost** for each SKU valid on the \`created_at\` date
2. Calculating per-item and order-level revenue, COGS, and profit
3. Persisting the result atomically

**Profit formula:**
\`\`\`
Item Profit  = (quantity × selling_price) - (quantity × unit_cost)
Order Profit = Total Revenue - Total COGS - shipping_cost
\`\`\`
          `,
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['order_id', 'created_at', 'shipping_cost', 'items'],
                  properties: {
                    order_id: { type: 'string', example: 'ORD001' },
                    created_at: { type: 'string', format: 'date', example: '2026-02-15' },
                    shipping_cost: { type: 'number', minimum: 0, example: 60 },
                    items: {
                      type: 'array',
                      minItems: 1,
                      items: { $ref: '#/components/schemas/OrderItem' },
                    },
                  },
                },
              },
            },
          },
          responses: {
            201: {
              description: 'Order processed with profit breakdown',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      order: { $ref: '#/components/schemas/Order' },
                      items: { type: 'array', items: { $ref: '#/components/schemas/OrderItemResult' } },
                    },
                  },
                },
              },
            },
            400: { description: 'Validation error', content: { 'application/json': { schema: { $ref: '#/components/schemas/ValidationError' } } } },
            404: { description: 'SKU not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
            409: { description: 'Duplicate order_id', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
            422: { description: 'No cost record for SKU on order date', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          },
        },
      },
      '/v1/orders/{order_id}': {
        get: {
          tags: ['Orders'],
          summary: 'Get a specific order by order_id',
          parameters: [
            { name: 'order_id', in: 'path', required: true, schema: { type: 'string' }, example: 'ORD001' },
          ],
          responses: {
            200: {
              description: 'Order details with item breakdown',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      order: { $ref: '#/components/schemas/Order' },
                      items: { type: 'array', items: { $ref: '#/components/schemas/OrderItemResult' } },
                    },
                  },
                },
              },
            },
            404: { description: 'Order not found' },
          },
        },
      },
      '/v1/dashboard': {
        get: {
          tags: ['Dashboard'],
          summary: 'Get aggregated profit metrics',
          description: 'Returns total revenue, COGS, shipping costs, and net profit across all orders. Supports pagination.',
          parameters: [
            { name: 'page', in: 'query', schema: { type: 'integer', default: 1, minimum: 1 }, description: 'Page number' },
            { name: 'limit', in: 'query', schema: { type: 'integer', default: 20, minimum: 1, maximum: 100 }, description: 'Orders per page' },
          ],
          responses: {
            200: {
              description: 'Dashboard metrics',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/DashboardMetrics' } } },
            },
            401: { description: 'Unauthorized' },
          },
        },
      },
    },
  },
  apis: [],
};

export const swaggerSpec = swaggerJsdoc(options);
