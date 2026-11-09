import { Router } from 'express';
import { appConfig } from '../config';
import { findTool, listTools, toolRegistry } from '../tools';
import { verifyScreenDisplayKey } from '../security/tokens';
import { IClientConfig } from '../types/kubequest.interfaces';
import { sendError, sendToolFailure } from './errors';

const screenOnlyTools: ReadonlySet<string> = new Set(['screen_token']);

function screenKeyFrom(query: unknown, header: string | undefined): string {
  const fromQuery = typeof query === 'string' ? query : '';

  return fromQuery !== '' ? fromQuery : (header ?? '');
}

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
    response.json(listTools().filter((tool) => !screenOnlyTools.has(tool.name)).map((tool) => tool.info()));
  });

  router.post('/api/tools/:name', async (request, response) => {
    const tool = findTool(request.params.name);

    if (screenOnlyTools.has(request.params.name)) {
      sendError(response, 403, 'screen_only', 'Only room screens can mint codes.');

      return;
    }

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
      const key = screenKeyFrom(request.query['key'], request.get('x-screen-key'));

      if (key === '' || !verifyScreenDisplayKey(request.params.locationId, key)) {
        sendError(response, 403, 'bad_screen_key', 'Only room screens can mint codes.');

        return;
      }

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
