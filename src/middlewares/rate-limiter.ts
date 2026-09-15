import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import Redis from 'ioredis';
import { Request, Response, NextFunction } from 'express';
import { config } from '../config';
import { logger } from '../logger';

let redisClient: Redis | null = null;
let store: any = undefined;

if (config.redisUrl) {
  try {
    redisClient = new Redis(config.redisUrl, {
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      lazyConnect: true,
    });

    redisClient.connect().then(() => {
      logger.info('Connected to Redis for distributed rate limiting');
    }).catch((err) => {
      logger.warn({ err: err.message }, 'Redis rate limiter connection failed, falling back to in-memory');
    });

    redisClient.on('error', (err) => {
      logger.warn({ err: err.message }, 'Redis connection error in rate limiter');
    });

    store = new RedisStore({
      // @ts-ignore
      sendCommand: (...args: string[]) => redisClient!.call(args[0], ...args.slice(1)),
      prefix: 'rl:',
    });
  } catch (err) {
    logger.warn({ err }, 'Failed to initialize Redis store for rate limiter, falling back to in-memory');
  }
}

const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  store,
  message: {
    error: 'Too many requests, please try again later.',
  },
});

export function rateLimiterMiddleware(req: Request, res: Response, next: NextFunction) {
  // Bypass rate limiting in test environment unless explicitly configured
  if (config.nodeEnv === 'test') {
    return next();
  }
  return limiter(req, res, next);
}

export function closeRedis(): void {
  if (redisClient) {
    redisClient.disconnect();
    redisClient = null;
  }
}
