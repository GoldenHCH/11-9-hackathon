import { HttpErrorResponse } from '@angular/common/http';

export class HttpErrorHelper {
  public static getFriendlyMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse && [0, 502, 503, 504].includes(error.status)) {
      return 'We could not reach the KubeQuest API. Check your connection and try again.';
    }

    if (error instanceof HttpErrorResponse && error.status >= 500) {
      return 'The KubeQuest API ran into a problem on its side. Please try again in a moment.';
    }

    return 'Something went wrong while talking to the KubeQuest API. Please try again.';
  }
}
