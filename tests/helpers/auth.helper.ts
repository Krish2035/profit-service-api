import request from 'supertest';
import { config } from '../../src/config';

/**
 * Exchange the configured API key for a JWT token and return a supertest
 * agent that automatically attaches the Authorization: Bearer header.
 */
export async function createAuthClient(app: any) {
  const res = await request(app)
    .post('/v1/auth/login')
    .send({ api_key: config.apiKey });

  const token = res.body.token as string;
  return request.agent(app).set('Authorization', `Bearer ${token}`);
}
