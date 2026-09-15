import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app';
import { closeDatabase } from '../src/model/database';
import { createAuthClient } from './helpers/auth.helper';

describe('Dashboard Metrics API', () => {
  let app: any;
  let client: any;

  beforeEach(async () => {
    app = createApp(':memory:');
    client = await createAuthClient(app);
  });

  afterEach(() => {
    closeDatabase();
  });

  it('should return zeroes when there are no orders', async () => {
    const res = await client.get('/v1/dashboard');
    assert.equal(res.status, 200);
    assert.equal(res.body.revenue, 0);
    assert.equal(res.body.profit, 0);
    assert.equal(res.body.total_orders, 0);
    assert.equal(res.body.page, 1);
    assert.equal(res.body.limit, 20);
  });

  it('should accurately aggregate totals and include pagination metadata', async () => {
    await client.post('/v1/products').send({ sku: 'SERUM001', name: 'Vitamin C Serum' });
    await client.post('/v1/products/SERUM001/cost').send({ cost: 450, effective_from: '2026-01-01' });
    await client.post('/v1/orders').send({
      order_id: 'ORD_DASH_1',
      created_at: '2026-02-01',
      shipping_cost: 5000,
      items: [{ sku: 'SERUM001', quantity: 100, selling_price: 1000 }],
    });

    const res = await client.get('/v1/dashboard');
    assert.equal(res.status, 200);
    assert.equal(res.body.revenue, 100000);
    assert.equal(res.body.cogs, 45000);
    assert.equal(res.body.shipping, 5000);
    assert.equal(res.body.profit, 50000);
    assert.equal(res.body.total_orders, 1);
  });

  it('should respect custom page and limit query parameters', async () => {
    const res = await client.get('/v1/dashboard?page=2&limit=5');
    assert.equal(res.status, 200);
    assert.equal(res.body.page, 2);
    assert.equal(res.body.limit, 5);
  });

  it('should clamp limit to maximum of 100', async () => {
    const res = await client.get('/v1/dashboard?limit=999');
    assert.equal(res.status, 200);
    assert.equal(res.body.limit, 100);
  });
});
