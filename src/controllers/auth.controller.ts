import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { eq } from 'drizzle-orm';
import { config } from '../config';
import { logger } from '../logger';
import { getDatabase } from '../model/database';
import { refreshTokensTable } from '../model/schema';

export class AuthController {
  /**
   * Helper to create signed access token
   */
  private generateAccessToken(userId: string = 'api-client'): string {
    return jwt.sign({ sub: userId, token_type: 'access' }, config.jwt.secret, {
      expiresIn: config.jwt.accessExpiresIn as any,
    });
  }

  /**
   * Helper to create and persist a refresh token
   */
  private generateAndSaveRefreshToken(userId: string = 'api-client'): string {
    const db = getDatabase();
    const refreshToken = crypto.randomBytes(40).toString('hex');
    
    // Default 7 days expiration
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    
    db.insert(refreshTokensTable)
      .values({
        id: uuidv4(),
        token: refreshToken,
        userId,
        expiresAt,
        revokedAt: null,
      })
      .run();

    return refreshToken;
  }

  /**
   * @openapi
   * /v1/auth/login:
   *   post:
   *     tags: [Authentication]
   *     summary: Exchange API key for Access and Refresh tokens
   *     description: Validates API key and returns a short-lived JWT access token plus a long-lived refresh token. Use the access token in the `Authorization: Bearer <token>` header for subsequent requests.
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [api_key]
   *             properties:
   *               api_key:
   *                 type: string
   *                 example: dev_api_key_shopify_2026
   *     responses:
   *       200:
   *         description: Tokens issued successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 token:
   *                   type: string
   *                 access_token:
   *                   type: string
   *                 refresh_token:
   *                   type: string
   *                 expires_in:
   *                   type: string
   *                   example: 15m
   *                 refresh_expires_in:
   *                   type: string
   *                   example: 7d
   *                 token_type:
   *                   type: string
   *                   example: Bearer
   *       400:
   *         description: Missing API key
   *       401:
   *         description: Invalid API key
   */
  login(req: Request, res: Response): void {
    const { api_key } = req.body;

    if (typeof api_key !== 'string' || api_key.trim().length === 0) {
      res.status(400).json({ error: 'api_key is required' });
      return;
    }

    // Timing-safe comparison to prevent key enumeration
    const provided = api_key.trim();
    const valid = config.apiKey;
    const isValid =
      provided.length === valid.length &&
      crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(valid));

    if (!isValid) {
      logger.warn({ ip: req.ip }, 'Failed login attempt with invalid API key');
      res.status(401).json({ error: 'Unauthorized: Invalid API key' });
      return;
    }

    const accessToken = this.generateAccessToken('api-client');
    const refreshToken = this.generateAndSaveRefreshToken('api-client');

    logger.info({ ip: req.ip }, 'JWT access & refresh tokens issued');

    res.status(200).json({
      token: accessToken,
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: config.jwt.accessExpiresIn,
      refresh_expires_in: config.jwt.refreshExpiresIn,
      token_type: 'Bearer',
    });
  }

  /**
   * @openapi
   * /v1/auth/refresh:
   *   post:
   *     tags: [Authentication]
   *     summary: Refresh access token with token rotation
   *     description: Submits an existing refresh token to receive a brand new access token and rotated refresh token. The previous refresh token is immediately revoked.
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [refresh_token]
   *             properties:
   *               refresh_token:
   *                 type: string
   *     responses:
   *       200:
   *         description: New access and refresh token pair generated
   *       400:
   *         description: Missing refresh token
   *       401:
   *         description: Invalid, expired, or revoked refresh token
   */
  refresh(req: Request, res: Response): void {
    const { refresh_token } = req.body;

    if (typeof refresh_token !== 'string' || refresh_token.trim().length === 0) {
      res.status(400).json({ error: 'refresh_token is required' });
      return;
    }

    const db = getDatabase();
    const tokenRecord = db
      .select()
      .from(refreshTokensTable)
      .where(eq(refreshTokensTable.token, refresh_token.trim()))
      .get();

    if (!tokenRecord) {
      logger.warn('Refresh attempt with non-existent token');
      res.status(401).json({ error: 'Unauthorized: Invalid refresh token' });
      return;
    }

    if (tokenRecord.revokedAt) {
      logger.warn({ token: refresh_token }, 'Refresh attempt with already revoked token (possible token reuse attack)');
      res.status(401).json({ error: 'Unauthorized: Refresh token has already been revoked' });
      return;
    }

    if (new Date(tokenRecord.expiresAt) < new Date()) {
      logger.warn('Refresh attempt with expired refresh token');
      res.status(401).json({ error: 'Unauthorized: Refresh token has expired' });
      return;
    }

    // Token Rotation: Invalidate current refresh token
    db.update(refreshTokensTable)
      .set({ revokedAt: new Date().toISOString() })
      .where(eq(refreshTokensTable.id, tokenRecord.id))
      .run();

    // Issue new access and refresh token pair
    const newAccessToken = this.generateAccessToken(tokenRecord.userId);
    const newRefreshToken = this.generateAndSaveRefreshToken(tokenRecord.userId);

    logger.info({ userId: tokenRecord.userId }, 'Rotated refresh token and generated new access token');

    res.status(200).json({
      token: newAccessToken,
      access_token: newAccessToken,
      refresh_token: newRefreshToken,
      expires_in: config.jwt.accessExpiresIn,
      refresh_expires_in: config.jwt.refreshExpiresIn,
      token_type: 'Bearer',
    });
  }

  /**
   * @openapi
   * /v1/auth/revoke:
   *   post:
   *     tags: [Authentication]
   *     summary: Revoke a refresh token (logout)
   *     description: Explicitly invalidates a refresh token so it can no longer be used to obtain access tokens.
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [refresh_token]
   *             properties:
   *               refresh_token:
   *                 type: string
   *     responses:
   *       200:
   *         description: Refresh token successfully revoked
   *       400:
   *         description: Missing refresh token
   */
  revoke(req: Request, res: Response): void {
    const { refresh_token } = req.body;

    if (typeof refresh_token !== 'string' || refresh_token.trim().length === 0) {
      res.status(400).json({ error: 'refresh_token is required' });
      return;
    }

    const db = getDatabase();
    db.update(refreshTokensTable)
      .set({ revokedAt: new Date().toISOString() })
      .where(eq(refreshTokensTable.token, refresh_token.trim()))
      .run();

    logger.info('Refresh token revoked successfully');
    res.status(200).json({ message: 'Refresh token revoked successfully' });
  }
}

export const authController = new AuthController();
