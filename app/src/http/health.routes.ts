import { Router } from 'express';
import type { IHealthResponse } from '@kubequest/shared';
import type { IContainer } from '../container.interfaces';

export function createHealthRouter(container: IContainer): Router {
  const router = Router();

  router.get('/readyz', (_request, response) => {
    response.status(200).type('text/plain').send('ok\n');
  });

  router.get('/healthz', async (_request, response) => {
    try {
      response.status(200).json(await container.esHealth.getHealth());
    } catch (error) {
      console.error('healthz: could not build the health report', error);

      const fallback: IHealthResponse = {
        status: 'degraded',
        version: container.config.version,
        elasticsearch: {
          configured: container.esClient.enabled,
          reachable: false,
          inferenceId: container.esClient.inferenceId,
          counts: {},
        },
      };

      response.status(200).json(fallback);
    }
  });

  return router;
}
