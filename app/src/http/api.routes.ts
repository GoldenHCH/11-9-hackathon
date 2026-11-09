import { Router } from 'express';
import { appConfig } from '../config';
import { findTool, listTools, toolRegistry } from '../tools';
import { IClientConfig } from '../types/kubequest.interfaces';
import { sendError, sendToolFailure } from './errors';

function clientConfig(): IClientConfig {
  const { rumEndpoint, rumAuthToken, traceUrlTemplate } = appConfig.telemetry;

  return {
    appVersion: appConfig.appVersion,
    publicBaseUrl: appConfig.publicBaseUrl,
    conferenceTimeZone: appConfig.conferenceTimeZone,
    ...(traceUrlTemplate ? { traceUrlTemplate } : {}),
    ...(rumEndpoint && rumAuthToken ? { rum: { endpoint: rumEndpoint, authToken: rumAuthToken } } : {}),
  };
}

export function apiRoutes(): Router {
  const router = Router();

  router.get('/api/config', (_request, response) => {
    response.json(clientConfig());
  });

  router.get('/api/tools', (_request, response) => {
    response.json(listTools().map((tool) => tool.info()));
  });

  router.post('/api/tools/:name', async (request, response) => {
    const tool = findTool(request.params.name);

    if (!tool) {
      sendError(response, 404, 'unknown_tool', `There is no tool called ${request.params.name}.`);

      return;
    }

    try {
      response.json(await tool.execute(request.body));
    } catch (error) {
      sendToolFailure(response, error);
    }
  });

  router.get('/api/screen-token/:locationId', async (request, response) => {
    try {
      response.json(await toolRegistry.screen_token.execute({ locationId: request.params.locationId }));
    } catch (error) {
      sendToolFailure(response, error);
    }
  });

  router.get('/api/recap/:attendeeId/email.html', async (request, response) => {
    try {
      const recap = await toolRegistry.recap.execute({ attendeeId: request.params.attendeeId });
      response.type('html').set('Cache-Control', 'no-store').send(recap.emailHtml);
    } catch (error) {
      sendToolFailure(response, error);
    }
  });

  router.use('/api', (_request, response) => {
    sendError(response, 404, 'not_found', 'That API route does not exist.');
  });

  return router;
}
