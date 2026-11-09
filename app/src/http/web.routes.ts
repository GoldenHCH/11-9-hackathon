import express, { Router } from 'express';
import { appConfig } from '../config';
import { hasSpaBuild, placeholderPage, spaIndexPath } from './spa';

export function webRoutes(): Router {
  const router = Router();

  router.use(express.static(appConfig.publicDir, { index: false, maxAge: '1h' }));

  router.get('/r/:locationId', (request, response) => {
    if (hasSpaBuild()) {
      response.sendFile(spaIndexPath());

      return;
    }

    const token = typeof request.query.t === 'string' ? request.query.t : '';
    response.json({
      locationId: request.params.locationId,
      hasToken: token !== '',
      next: {
        method: 'POST',
        path: '/api/tools/check_in',
        body: { attendeeId: '<your attendee id>', locationId: request.params.locationId, token: '<the t query parameter>' },
      },
      signUpFirst: { method: 'POST', path: '/api/tools/sign_up', bodyIncludes: { scanLocationId: request.params.locationId, scanToken: '<the t query parameter>' } },
    });
  });

  router.get('/h/:token', (request, response) => {
    if (hasSpaBuild()) {
      response.sendFile(spaIndexPath());

      return;
    }

    response.json({
      hasToken: request.params.token !== '',
      next: { method: 'POST', path: '/api/tools/start_handshake', body: { attendeeId: '<your attendee id>', token: '<the path segment after /h/>' } },
    });
  });

  router.use((request, response, next) => {
    if (request.method !== 'GET' || !request.accepts('html')) {
      next();

      return;
    }

    if (hasSpaBuild()) {
      response.sendFile(spaIndexPath());

      return;
    }

    if (request.path === '/') {
      response.type('html').send(placeholderPage());

      return;
    }

    next();
  });

  return router;
}
