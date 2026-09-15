import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app';
import { closeDatabase } from '../src/model/database';
import { createAuthClient } from './helpers/auth.helper';

describe('Products & Cost History API', () => {
  let app: any;
  let client: any;

  beforeEach(async () => {
    app = createApp(':memory:');
    client = await createAuthClient(app);
  });

  afterEach(() => {
    closeDatabase();
  });

  it('should successfully create a product', async () => {
    const res = await client.post('/v1/products').send({
      sku: 'SERUM001',
      name: 'Vitamin C Serum',
    });

    assert.equal(res.status, 201);
    assert.ok(res.body.id);
    assert.equal(res.body.sku, 'SERUM001');
    assert.equal(res.body.name, 'Vitamin C Serum');
  });

  it('should reject duplicate SKUs with 409 Conflict', async () => {
    await client.post('/v1/products').send({ sku: 'SERUM001', name: 'Vitamin C Serum' });
    const res = await client.post('/v1/products').send({ sku: 'SERUM001', name: 'Another Serum' });
    assert.equal(res.status, 409);
    assert.match(res.body.error, /already exists/i);
  });

  it('should reject invalid product payloads with 400 Bad Request', async () => {
    const res = await client.post('/v1/products').send({ sku: '', name: '' });
    assert.equal(res.status, 400);
    assert.equal(res.body.error, 'Validation Error');
  });

  it('should add cost history records to a product by ID or SKU', async () => {
    const createRes = await client.post('/v1/products').send({ sku: 'SERUM001', name: 'Vitamin C Serum' });
    const productId = createRes.body.id;

    const costRes1 = await client.post(`/v1/products/${productId}/cost`).send({ cost: 350, effective_from: '2026-01-01' });
    assert.equal(costRes1.status, 201);
    assert.equal(costRes1.body.cost, 350);

    const costRes2 = await client.post('/v1/products/SERUM001/cost').send({ cost: 400, effective_from: '2026-03-01' });
    assert.equal(costRes2.status, 201);
    assert.equal(costRes2.body.cost, 400);

    const historyRes = await client.get(`/v1/products/${productId}/cost`);
    assert.equal(historyRes.status, 200);
    assert.equal(historyRes.body.length, 2);
    assert.equal(historyRes.body[0].cost, 400);
    assert.equal(historyRes.body[1].cost, 350);
  });

  it('should reject negative costs with 400 Bad Request', async () => {
    const createRes = await client.post('/v1/products').send({ sku: 'CREAM001', name: 'Night Cream' });
    const res = await client.post(`/v1/products/${createRes.body.id}/cost`).send({ cost: -50, effective_from: '2026-01-01' });
    assert.equal(res.status, 400);
    assert.equal(res.body.details[0].field, 'cost');
  });

  it('should reject invalid dates with 400 Bad Request', async () => {
    const createRes = await client.post('/v1/products').send({ sku: 'CREAM002', name: 'Day Cream' });
    const res = await client.post(`/v1/products/${createRes.body.id}/cost`).send({ cost: 100, effective_from: 'not-a-valid-date' });
    assert.equal(res.status, 400);
    assert.equal(res.body.details[0].field, 'effective_from');
  });

  it('should reject permissive date strings like "February 15" with 400', async () => {
    const createRes = await client.post('/v1/products').send({ sku: 'CREAM003', name: 'Eye Cream' });
    const res = await client.post(`/v1/products/${createRes.body.id}/cost`).send({ cost: 100, effective_from: 'February 15 2026' });
    assert.equal(res.status, 400);
  });

  it('should return 404 when adding cost for a non-existent product', async () => {
    const res = await client.post('/v1/products/non-existent-id/cost').send({ cost: 100, effective_from: '2026-01-01' });
    assert.equal(res.status, 404);
  });
});
