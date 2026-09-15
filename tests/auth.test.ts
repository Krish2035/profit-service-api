import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../src/app';
import { closeDatabase } from '../src/model/database';
import { config } from '../src/config';

// Helper: get a JWT token for test requests
async function getToken(app: any): Promise<string> {
  const res = await request(app)
    .post('/v1/auth/login')
    .send({ api_key: config.apiKey });
  return res.body.token;
}

describe('Authentication & JWT Flow with Refresh Tokens', () => {
  let app: any;

  beforeEach(() => {
    app = createApp(':memory:');
  });

  afterEach(() => {
    closeDatabase();
  });

  it('should allow public access to /health without token', async () => {
    const res = await request(app).get('/health');
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'ok');
  });

  it('should allow public access to /api-docs', async () => {
    const res = await request(app).get('/api-docs/');
    assert.equal(res.status, 200);
  });

  it('should issue both access_token and refresh_token on POST /v1/auth/login with valid api_key', async () => {
    const res = await request(app)
      .post('/v1/auth/login')
      .send({ api_key: config.apiKey });

    assert.equal(res.status, 200);
    assert.ok(res.body.token);
    assert.ok(res.body.access_token);
    assert.ok(res.body.refresh_token);
    assert.equal(res.body.token_type, 'Bearer');
    assert.equal(res.body.expires_in, config.jwt.accessExpiresIn);
    assert.equal(res.body.refresh_expires_in, config.jwt.refreshExpiresIn);
  });

  it('should reject login with invalid api_key', async () => {
    const res = await request(app)
      .post('/v1/auth/login')
      .send({ api_key: 'wrong_key' });

    assert.equal(res.status, 401);
    assert.match(res.body.error, /Invalid API key/i);
  });

  it('should rotate tokens on POST /v1/auth/refresh and reject reused tokens', async () => {
    // 1. Login to get initial refresh token
    const loginRes = await request(app)
      .post('/v1/auth/login')
      .send({ api_key: config.apiKey });

    const initialRefreshToken = loginRes.body.refresh_token;
    assert.ok(initialRefreshToken);

    // 2. Use refresh token to obtain a new token pair
    const refreshRes = await request(app)
      .post('/v1/auth/refresh')
      .send({ refresh_token: initialRefreshToken });

    assert.equal(refreshRes.status, 200);
    assert.ok(refreshRes.body.access_token);
    assert.ok(refreshRes.body.refresh_token);
    assert.notEqual(refreshRes.body.refresh_token, initialRefreshToken);

    // 3. Verify new access token works against protected route
    const dashRes = await request(app)
      .get('/v1/dashboard')
      .set('Authorization', `Bearer ${refreshRes.body.access_token}`);
    assert.equal(dashRes.status, 200);

    // 4. Token Rotation check: old refresh token must now be revoked and rejected
    const reuseRes = await request(app)
      .post('/v1/auth/refresh')
      .send({ refresh_token: initialRefreshToken });

    assert.equal(reuseRes.status, 401);
    assert.match(reuseRes.body.error, /revoked/i);
  });

  it('should revoke a refresh token on POST /v1/auth/revoke', async () => {
    const loginRes = await request(app)
      .post('/v1/auth/login')
      .send({ api_key: config.apiKey });

    const refreshToken = loginRes.body.refresh_token;

    const revokeRes = await request(app)
      .post('/v1/auth/revoke')
      .send({ refresh_token: refreshToken });

    assert.equal(revokeRes.status, 200);
    assert.match(revokeRes.body.message, /revoked successfully/i);

    // Attempting to refresh with revoked token should fail
    const refreshRes = await request(app)
      .post('/v1/auth/refresh')
      .send({ refresh_token: refreshToken });

    assert.equal(refreshRes.status, 401);
  });

  it('should reject protected routes without a token (401)', async () => {
    const res = await request(app).get('/v1/dashboard');
    assert.equal(res.status, 401);
    assert.match(res.body.error, /Bearer token required/i);
  });

  it('should reject protected routes with an invalid token (401)', async () => {
    const res = await request(app)
      .get('/v1/dashboard')
      .set('Authorization', 'Bearer totally.invalid.token');
    assert.equal(res.status, 401);
    assert.match(res.body.error, /Invalid token/i);
  });

  it('should allow protected routes with a valid JWT token', async () => {
    const token = await getToken(app);
    const res = await request(app)
      .get('/v1/dashboard')
      .set('Authorization', `Bearer ${token}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.profit, 0);
  });
});
