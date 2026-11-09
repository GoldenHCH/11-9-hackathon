import * as fs from 'node:fs';
import * as path from 'node:path';
import express, { Router } from 'express';
import type { IAppConfig } from '../config/config.interfaces';

export function findWebRoot(config: IAppConfig): string | undefined {
  return [config.publicDir, ...config.webDistDirs].find((directory) => fs.existsSync(path.join(directory, 'index.html')));
}

export function createStaticRouter(config: IAppConfig): Router {
  const router = Router();
  const webRoot = findWebRoot(config);

  if (!webRoot) {
    router.get(/^\/(?!api\/).*/, (_request, response) => {
      response.status(200).type('text/plain').send('KubeQuest api is running. The web app is not bundled in this build yet.\n');
    });

    return router;
  }

  router.use(express.static(webRoot, { index: 'index.html' }));
  router.get(/^\/(?!api\/).*/, (_request, response) => {
    response.sendFile(path.join(webRoot, 'index.html'));
  });

  return router;
}
