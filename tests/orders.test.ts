import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app';
import { closeDatabase } from '../src/model/database';
import { createAuthClient } from './helpers/auth.helper';

describe('Orders & Historical Cost Profit API', () => {
  let app: any;
  let client: any;

  beforeEach(async () => {
    app = createApp(':memory:');
    client = await createAuthClient(app);

    await client.post('/v1/products').send({ sku: 'SERUM001', name: 'Vitamin C Serum' });
    await client.post('/v1/products/SERUM001/cost').send({ cost: 350, effective_from: '2026-01-01' });
    await client.post('/v1/products/SERUM001/cost').send({ cost: 400, effective_from: '2026-03-01' });
  });

  afterEach(() => {
    closeDatabase();
  });

  it('should use Jan cost (350) for order on Feb 15 and calculate correct profit', async () => {
    const res = await client.post('/v1/orders').send({
      order_id: 'ORD001',
      created_at: '2026-02-15',
      shipping_cost: 60,
      items: [{ sku: 'SERUM001', quantity: 2, selling_price: 999 }],
    });

    assert.equal(res.status, 201);
    const { order, items } = res.body;
    assert.equal(order.order_id, 'ORD001');
    assert.equal(order.shipping_cost, 60);
    assert.equal(order.total_revenue, 1998);
    assert.equal(order.total_cogs, 700);
    assert.equal(order.total_profit, 1238);
    assert.equal(items[0].unit_cost, 350);
    assert.equal(items[0].item_profit, 1298);
  });

  it('should use March cost (400) for order on March 15', async () => {
    const res = await client.post('/v1/orders').send({
      order_id: 'ORD002',
      created_at: '2026-03-15',
      shipping_cost: 40,
      items: [{ sku: 'SERUM001', quantity: 3, selling_price: 1000 }],
    });

    assert.equal(res.status, 201);
    assert.equal(res.body.order.total_revenue, 3000);
    assert.equal(res.body.order.total_cogs, 1200);
    assert.equal(res.body.order.total_profit, 1760);
    assert.equal(res.body.items[0].unit_cost, 400);
  });

  it('should reject order if date precedes all cost records (422)', async () => {
    const res = await client.post('/v1/orders').send({
      order_id: 'ORD_EARLY',
      created_at: '2025-12-15',
      shipping_cost: 50,
      items: [{ sku: 'SERUM001', quantity: 1, selling_price: 999 }],
    });
    assert.equal(res.status, 422);
    assert.match(res.body.error, /No cost record found for SKU/i);
  });

  it('should reject duplicate order_id with 409 Conflict', async () => {
    const payload = {
      order_id: 'ORD_DUP',
      created_at: '2026-02-15',
      shipping_cost: 50,
      items: [{ sku: 'SERUM001', quantity: 1, selling_price: 999 }],
    };
    const res1 = await client.post('/v1/orders').send(payload);
    assert.equal(res1.status, 201);
    const res2 = await client.post('/v1/orders').send(payload);
    assert.equal(res2.status, 409);
  });

  it('should reject duplicate SKUs in a single order with 400', async () => {
    const res = await client.post('/v1/orders').send({
      order_id: 'ORD_DUP_SKU',
      created_at: '2026-02-15',
      shipping_cost: 50,
      items: [
        { sku: 'SERUM001', quantity: 1, selling_price: 999 },
        { sku: 'SERUM001', quantity: 2, selling_price: 999 },
      ],
    });
    assert.equal(res.status, 400);
    assert.match(res.body.details[0].message, /Duplicate SKUs are not allowed/i);
  });

  it('should reject negative shipping_cost or selling_price with 400', async () => {
    const r1 = await client.post('/v1/orders').send({ order_id: 'N1', created_at: '2026-02-15', shipping_cost: -10, items: [{ sku: 'SERUM001', quantity: 1, selling_price: 999 }] });
    assert.equal(r1.status, 400);
    const r2 = await client.post('/v1/orders').send({ order_id: 'N2', created_at: '2026-02-15', shipping_cost: 10, items: [{ sku: 'SERUM001', quantity: 1, selling_price: -50 }] });
    assert.equal(r2.status, 400);
  });

  it('should retrieve a created order by ID', async () => {
    await client.post('/v1/orders').send({ order_id: 'ORD_FETCH', created_at: '2026-02-20', shipping_cost: 25, items: [{ sku: 'SERUM001', quantity: 2, selling_price: 500 }] });
    const res = await client.get('/v1/orders/ORD_FETCH');
    assert.equal(res.status, 200);
    assert.equal(res.body.order.order_id, 'ORD_FETCH');
    assert.equal(res.body.items.length, 1);
  });

  it('should correctly handle a multi-item order using batch product lookup', async () => {
    await client.post('/v1/products').send({ sku: 'CREAM001', name: 'Night Cream' });
    await client.post('/v1/products/CREAM001/cost').send({ cost: 200, effective_from: '2026-01-01' });

    const res = await client.post('/v1/orders').send({
      order_id: 'ORD_MULTI',
      created_at: '2026-02-15',
      shipping_cost: 100,
      items: [
        { sku: 'SERUM001', quantity: 2, selling_price: 999 },
        { sku: 'CREAM001', quantity: 1, selling_price: 500 },
      ],
    });

    assert.equal(res.status, 201);
    assert.equal(res.body.order.total_revenue, 2498);
    assert.equal(res.body.order.total_cogs, 900);
    assert.equal(res.body.order.total_profit, 1498);
    assert.equal(res.body.items.length, 2);
  });
});
