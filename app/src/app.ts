import express, { Express, NextFunction, Request, Response } from 'express';
import { apiRoutes } from './http/api.routes';
import { authRoutes } from './http/auth.routes';
import { sendError } from './http/errors';
import { healthRoutes } from './http/health.routes';
import { webRoutes } from './http/web.routes';
import { logger } from './observability/logger';

const quietPaths = new Set(['/healthz', '/readyz']);

function requestLogger(request: Request, response: Response, next: NextFunction): void {
  const startedAt = performance.now();

  response.on('finish', () => {
    if (quietPaths.has(request.path)) {
      return;
    }

    logger.info(
      {
        'http.request.method': request.method,
        'url.path': request.path,
        'http.route': request.route?.path,
        'http.response.status_code': response.statusCode,
        duration_ms: Math.round(performance.now() - startedAt),
      },
      'request completed',
    );
  });
  next();
}

function malformedBodyHandler(error: unknown, _request: Request, response: Response, next: NextFunction): void {
  if (error instanceof SyntaxError) {
    sendError(response, 400, 'invalid_json', 'The request body is not valid JSON.');

    return;
  }

  next(error);
}

function fallbackErrorHandler(error: unknown, _request: Request, response: Response, _next: NextFunction): void {
  logger.error({ err: error }, 'unhandled request error');
  sendError(response, 500, 'internal_error', 'Something went wrong on our side. Try again in a moment.');
}

export function createApp(): Express {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', true);
  app.use(requestLogger);
  app.use('/api/tools/upload_booth_photo', express.json({ limit: '600kb' }));
  app.use(express.json({ limit: '100kb' }));
  app.use(malformedBodyHandler);
  app.use(healthRoutes());
  app.use(apiRoutes());
  app.use(authRoutes());
  app.use(webRoutes());
  app.use((_request, response) => {
    sendError(response, 404, 'not_found', 'Nothing lives at this address.');
  });
  app.use(fallbackErrorHandler);

  return app;
}
