import { HttpErrorResponse } from '@angular/common/http';

const fallbackMessage = 'Something went wrong. Check your connection and try again.';

export class ApiErrorHelper {
  public static message(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const body: unknown = error.error;

      if (typeof body === 'object' && body !== null && 'error' in body) {
        const apiError: unknown = body.error;

        if (typeof apiError === 'object' && apiError !== null && 'message' in apiError && typeof apiError.message === 'string') {
          return apiError.message;
        }
      }

      if (error.status === 0) {
        return 'You look offline. Check your connection and try again.';
      }
    }

    return fallbackMessage;
  }
}
