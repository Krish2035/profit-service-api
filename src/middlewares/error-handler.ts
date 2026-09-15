import { Request, Response, NextFunction } from 'express';
import { logger } from '../logger';

export class HttpError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
    this.name = 'HttpError';
  }
}

export class NotFoundError extends HttpError {
  constructor(message: string = 'Resource not found') {
    super(404, message);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends HttpError {
  constructor(message: string = 'Resource conflict') {
    super(409, message);
    this.name = 'ConflictError';
  }
}

export class UnprocessableEntityError extends HttpError {
  constructor(message: string) {
    super(422, message);
    this.name = 'UnprocessableEntityError';
  }
}

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  // Custom HTTP errors
  if (err instanceof HttpError) {
    logger.warn({ statusCode: err.statusCode, path: req.path, err: err.message }, 'HTTP error');
    return res.status(err.statusCode).json({ error: err.message });
  }

  // SQLite unique constraint violations
  if (err && typeof err === 'object' && 'code' in err && (err as any).code === 'SQLITE_CONSTRAINT_UNIQUE') {
    logger.warn({ path: req.path }, 'SQLite unique constraint violation');
    return res.status(409).json({
      error: 'Conflict: A resource with this unique identifier already exists',
      details: (err as any).message,
    });
  }

  // Unknown errors
  logger.error({ err, path: req.path, method: req.method }, 'Unhandled server error');
  return res.status(500).json({
    error: 'Internal Server Error',
    message: err instanceof Error ? err.message : 'An unexpected error occurred',
  });
}
