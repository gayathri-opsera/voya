/**
 * Auth service Express application factory.
 *
 * Creates the Express app with versioned routes and a shared error handler.
 * All dependencies are injected — the factory itself imports no Prisma,
 * JWKS, or environment configuration.
 */

import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import { createBonvoyStartRoute } from './routes/bonvoyStart.js';
import { createBonvoyCallbackRoute } from './routes/bonvoyCallback.js';
import type { AuthServiceDeps } from './types.js';
import { generateCorrelationId } from './lib/correlationId.js';

export function createApp(deps: AuthServiceDeps) {
  const app = express();

  app.use(express.json({ limit: '64kb' }));

  // Attach correlation ID to every request
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.locals['correlationId'] = generateCorrelationId();
    next();
  });

  const router = express.Router();
  router.get('/bonvoy/start',    createBonvoyStartRoute(deps));
  router.post('/bonvoy/callback', createBonvoyCallbackRoute(deps));

  app.use('/v1/auth', router);

  // 404 handler for unknown paths
  app.use((_req: Request, res: Response) => {
    res.status(404).json({
      code:          'NOT_FOUND',
      message:       'The requested endpoint does not exist',
      correlationId: (res.locals['correlationId'] as string | undefined) ?? 'unknown',
    });
  });

  // Global error handler — never leaks stack traces, tokens, or PII
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    deps.logger.error('Unhandled error in auth service', {
      correlationId: (res.locals['correlationId'] as string | undefined) ?? 'unknown',
      operation:     'unhandled_error',
    });
    res.status(500).json({
      code:          'INTERNAL_ERROR',
      message:       'An unexpected error occurred',
      correlationId: (res.locals['correlationId'] as string | undefined) ?? 'unknown',
    });
  });

  return app;
}
