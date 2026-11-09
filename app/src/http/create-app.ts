import express from 'express';
import type { ErrorRequestHandler, Express } from 'express';
import type { IToolErrorResponse } from '@kubequest/shared';
import type { IContainer } from '../container.interfaces';
import { ToolRunnerService } from '../tools/tool-runner.service';
import type { ToolRegistry } from '../tools/tools.types';
import { createHealthRouter } from './health.routes';
import { createStaticRouter } from './static.routes';
import { createToolsRouter } from './tools.routes';

const handleError: ErrorRequestHandler = (error, _request, response, next) => {
  if (response.headersSent) {
    next(error);

    return;
  }

  const isBadJson = typeof error === 'object' && error !== null && 'type' in error && error.type === 'entity.parse.failed';
  const body: IToolErrorResponse = {
    error: isBadJson ? 'That request body is not valid JSON.' : 'Something went wrong on our side. Please try again in a moment.',
  };

  if (!isBadJson) {
    console.error('unhandled request error', error);
  }

  response.status(isBadJson ? 400 : 500).json(body);
};

export function createApp(container: IContainer, registry: ToolRegistry): Express {
  const app = express();

  app.disable('x-powered-by');
  app.use(express.json({ limit: '100kb' }));
  app.use(createHealthRouter(container));
  app.use('/api/tools', createToolsRouter(new ToolRunnerService(registry)));
  app.use('/api', (_request, response) => {
    const body: IToolErrorResponse = { error: 'We could not find that endpoint.' };
    response.status(404).json(body);
  });
  app.use(createStaticRouter(container.config));
  app.use(handleError);

  return app;
}
