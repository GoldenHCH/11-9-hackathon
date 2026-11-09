import { Router } from 'express';
import type { IToolErrorResponse } from '@kubequest/shared';
import { ToolInputError, UnknownToolError } from '../tools/tools.errors';
import { ToolRunnerService } from '../tools/tool-runner.service';

export function createToolsRouter(runner: ToolRunnerService): Router {
  const router = Router();

  router.get('/', (_request, response) => {
    response.json(runner.describeAll());
  });

  router.post('/:name', async (request, response) => {
    try {
      response.json(await runner.run(request.params.name, request.body ?? {}));
    } catch (error) {
      if (error instanceof UnknownToolError) {
        const body: IToolErrorResponse = { error: error.message };
        response.status(404).json(body);

        return;
      }

      if (error instanceof ToolInputError) {
        const body: IToolErrorResponse = { error: error.message };
        response.status(400).json(body);

        return;
      }

      console.error(`tool ${request.params.name} failed`, error);

      const body: IToolErrorResponse = { error: 'Something went wrong on our side. Please try again in a moment.' };
      response.status(500).json(body);
    }
  });

  return router;
}
