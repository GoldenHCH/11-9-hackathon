import { Router } from 'express';
import type { IScreenToken, IToolErrorResponse } from '@kubequest/shared';
import type { ResourceStoreService } from '../resources/resource-store.service';
import { mintScreenToken } from '../security/tokens';

export function createScreenTokenRouter(store: ResourceStoreService): Router {
  const router = Router();

  router.get('/:locationId', (request, response) => {
    const location = store.getLocation(request.params.locationId);

    if (!location) {
      const body: IToolErrorResponse = { error: `We could not find a location with the id "${request.params.locationId}".` };
      response.status(404).json(body);

      return;
    }

    const body: IScreenToken = mintScreenToken(location.id);

    response.set('Cache-Control', 'no-store').json(body);
  });

  return router;
}
