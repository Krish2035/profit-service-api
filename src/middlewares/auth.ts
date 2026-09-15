import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { logger } from '../logger';

export interface JwtPayload {
  sub: string;
  iat?: number;
  exp?: number;
}

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  // /health is always public
  if (req.path === '/health') {
    return next();
  }

  const authHeader = req.headers['authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    logger.warn({ path: req.path, method: req.method }, 'Missing or malformed Authorization header');
    return res.status(401).json({
      error: 'Unauthorized: Bearer token required. Use POST /v1/auth/login to get a token.',
    });
  }

  const token = authHeader.substring(7).trim();

  try {
    const decoded = jwt.verify(token, config.jwt.secret) as JwtPayload;
    // Attach decoded payload to request for downstream use
    (req as any).user = decoded;
    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      logger.warn({ path: req.path }, 'JWT token expired');
      return res.status(401).json({ error: 'Unauthorized: Token has expired' });
    }
    logger.warn({ path: req.path }, 'Invalid JWT token');
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
}
