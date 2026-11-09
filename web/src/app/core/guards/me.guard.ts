import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { MeService } from '../services/me.service';

export const meGuard: CanActivateFn = (_route, state) => {
  const meService = inject(MeService);
  const router = inject(Router);

  if (meService.attendeeId) {
    return true;
  }

  return router.createUrlTree(['/onboarding'], { queryParams: { next: state.url } });
};
