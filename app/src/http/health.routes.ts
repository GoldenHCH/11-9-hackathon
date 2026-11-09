import { Router } from 'express';
import { appConfig } from '../config';
import { isElasticConfigured, pingElastic } from '../es/client';

const readinessCacheMs = 5000;

let lastReadiness: { checkedAt: number; elasticsearch: boolean } | undefined;

async function elasticReachable(): Promise<boolean> {
  const now = Date.now();

  if (lastReadiness && now - lastReadiness.checkedAt < readinessCacheMs) {
    return lastReadiness.elasticsearch;
  }

  const elasticsearch = await pingElastic();
  lastReadiness = { checkedAt: now, elasticsearch };

  return elasticsearch;
}

export function healthRoutes(): Router {
  const router = Router();

  router.get('/healthz', (_request, response) => {
    response.json({ status: 'ok', version: appConfig.appVersion });
  });

  router.get('/readyz', async (_request, response) => {
    if (!isElasticConfigured()) {
      response.json({ status: 'ok', version: appConfig.appVersion, elasticsearch: 'not_configured' });

      return;
    }

    const reachable = await elasticReachable();
    response.status(reachable ? 200 : 503).json({
      status: reachable ? 'ok' : 'unavailable',
      version: appConfig.appVersion,
      elasticsearch: reachable ? 'reachable' : 'unreachable',
    });
  });

  return router;
}
