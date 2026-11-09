import express, { Request, Router } from 'express';
import { appConfig } from '../config';
import { pdfToText } from '../profile/pdf-text';
import { importLimits } from '../profile/profile.constants';
import { ToolError } from '../tools/tool-errors';
import { findTool, listTools, toolRegistry } from '../tools';
import { verifyScreenDisplayKey } from '../security/tokens';
import { IClientConfig } from '../types/kubequest.interfaces';
import { sendError, sendToolFailure } from './errors';

const screenOnlyTools: ReadonlySet<string> = new Set(['screen_token']);

function screenKeyFrom(query: unknown, header: string | undefined): string {
  const fromQuery = typeof query === 'string' ? query : '';

  return fromQuery !== '' ? fromQuery : (header ?? '');
}

async function readUpload(request: Request): Promise<{ attendeeId: string; bytes: Uint8Array }> {
  const contentType = request.get('content-type') ?? '';

  if (!contentType.startsWith('multipart/form-data') || !Buffer.isBuffer(request.body)) {
    throw new ToolError(400, 'invalid_input', 'Send the PDF as multipart/form-data with a "file" field and your attendeeId.');
  }

  const form = await new globalThis.Request('http://upload.local/', { method: 'POST', headers: { 'content-type': contentType }, body: request.body }).formData();
  const attendeeId = form.get('attendeeId');
  const file = form.get('file');

  if (typeof attendeeId !== 'string' || attendeeId.trim() === '' || file === null || typeof file === 'string') {
    throw new ToolError(400, 'invalid_input', 'Send the PDF in a "file" field and your attendeeId.');
  }

  if (file.type !== '' && file.type !== 'application/pdf') {
    throw new ToolError(415, 'not_a_pdf', 'That file is not a PDF. Upload a PDF, or paste the text instead.');
  }

  return { attendeeId: attendeeId.trim(), bytes: new Uint8Array(await file.arrayBuffer()) };
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

  router.post('/api/profile-import', express.raw({ type: 'multipart/form-data', limit: importLimits.MAX_PDF_BYTES + 64 * 1024 }), async (request, response) => {
    try {
      const { attendeeId, bytes } = await readUpload(request);
      const text = await pdfToText(bytes);
      response.set('Cache-Control', 'no-store').json(await toolRegistry.import_profile.execute({ attendeeId, text }));
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
