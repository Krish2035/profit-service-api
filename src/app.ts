import express, { Express } from 'express';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './swagger';
import routes from './routes';
import authRoutes from './routes/auth.routes';
import { errorHandler } from './middlewares/error-handler';
import { authMiddleware } from './middlewares/auth';
import { rateLimiterMiddleware } from './middlewares/rate-limiter';
import { requestLogger } from './middlewares/request-logger';
import { initDatabase } from './model/database';
import { logger } from './logger';

export function createApp(dbPath?: string): Express {
  if (dbPath) {
    initDatabase(dbPath);
  }

  const app = express();

  // Body parsing
  app.use(express.json());

  // Request logging
  app.use(requestLogger);

  // Global Rate Limiting
  app.use(rateLimiterMiddleware);

  // Public: Health check
  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Public: Swagger UI
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customSiteTitle: 'Profit Service API',
    customCss: '.swagger-ui .topbar { display: none }',
    swaggerOptions: { persistAuthorization: true },
  }));

  // Public: Raw OpenAPI JSON spec
  app.get('/api-docs.json', (_req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });

  // Public: Auth login (issue JWT) — BEFORE authMiddleware
  app.use('/v1/auth', authRoutes);

  // JWT authentication for all subsequent routes
  app.use(authMiddleware);

  // Protected API routes
  app.use('/', routes);

  // Global Error Handler (must be last)
  app.use(errorHandler);

  return app;
}

export const app = createApp();

logger.info('Application initialized');
